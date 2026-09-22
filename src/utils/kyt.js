import { lookupKeys, detectNetwork, sourceLabel, checkTronSecurity, USDT_TRON, getCanonical } from './aml.js'

// KYT-lite (phase 1): 1-hop exposure + behavioral scoring for TRON.
// No backend: Tronscan public API only (no key needed for these endpoints).
// Honest scope: direct counterparties only, no deep graph traversal.

const TRONSCAN = 'https://apilist.tronscanapi.com/api'
const TRANSFER_LIMIT = 200

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Tronscan: HTTP ${res.status}`)
  return res.json()
}

export async function fetchTronAccount(address) {
  try {
    const j = await getJSON(`${TRONSCAN}/account?address=${address}`)
    return {
      createTime: j?.createTime || null,
      balanceSun: j?.balance ?? 0,
      totalTx: j?.totalTransactionCount ?? null,
    }
  } catch {
    return { createTime: null, balanceSun: 0, totalTx: null }
  }
}

export async function fetchTronTransfers(address) {
  // TRC-20 transfers (incl. USDT) + native TRX transfers, newest first.
  const [trc20, trx] = await Promise.all([
    getJSON(`${TRONSCAN}/token_trc20/transfers?relatedAddress=${address}&limit=${TRANSFER_LIMIT}&sort=-timestamp`).catch(() => ({ data: [] })),
    getJSON(`${TRONSCAN}/transaction?address=${address}&limit=${TRANSFER_LIMIT}&sort=-timestamp`).catch(() => ({ data: [] })),
  ])
  return {
    trc20: Array.isArray(trc20?.data) ? trc20.data : [],
    trx: Array.isArray(trx?.data) ? trx.data : [],
  }
}

function toUsdtish(t) {
  // Best-effort USDT volume: TRC-20 USDT has 6 decimals.
  const sym = String(t?.tokenInfo?.tokenAbbr || t?.tokenAbbr || '').toUpperCase()
  const dec = Number(t?.tokenInfo?.tokenDecimal ?? t?.tokenDecimal ?? NaN)
  if (sym !== 'USDT' || !Number.isFinite(dec)) return 0
  return Number(t.value || 0) / 10 ** dec
}

// Full deep check with BFS. self = { verdict, matches, frozen } from the quick engine.
// opts: { depth (1-5), onProgress }.
// Returns report { score, level, depth, exposurePct, factors[], stats, dirtyPeers[], generatedAt }.
export async function analyzeKyt(address, index, self, opts = {}) {
  const a = String(address).trim()
  const community = opts.community || null
  const factors = []
  const add = (points, label, detail = '') => {
    if (points > 0) factors.push({ points, label, detail })
  }

  // 0. Self signals from the quick engine (already computed).
  let score = 0
  if (self?.frozen === true) {
    score += 60
    add(60, 'Адрес заморожен Tether', 'Переводы USDT заблокированы эмитентом')
  }
  for (const m of self?.matches || []) {
    if (m.source === 'TETHER_FROZEN') continue // counted above
    score += 60
    add(60, `Адрес в санкциях: ${m.label}`, 'Прямое совпадение с OFAC SDN')
    break
  }
  const secHits = (self?.matches || []).filter((m) => m.source === 'TRONSCAN_SEC')
  if (secHits.length > 0) {
    score += 40
    add(40, 'Флаги Tronscan Security', secHits.map((m) => m.label).join('; '))
  }

  // 1. Chain data.
  const [account, transfers] = await Promise.all([fetchTronAccount(a), fetchTronTransfers(a)])
  const now = Date.now()
  const ageDays = account.createTime ? (now - account.createTime) / 86400000 : null

  const peers = new Map() // addr -> { txs, inN, outN, usdtIn, usdtOut }
  const touch = (x) => {
    if (!peers.has(x)) peers.set(x, { txs: 0, inN: 0, outN: 0, usdtIn: 0, usdtOut: 0 })
    return peers.get(x)
  }
  let inCount = 0
  let outCount = 0
  let usdtIn = 0
  let usdtOut = 0
  let firstTs = null
  let lastTs = null
  let dustIn = 0
  const fakeContracts = new Set()
  const bumpTs = (ts) => {
    if (!ts) return
    if (!firstTs || ts < firstTs) firstTs = ts
    if (!lastTs || ts > lastTs) lastTs = ts
  }
  for (const t of transfers.trc20) {
    const ts = t?.block_timestamp || t?.timestamp
    bumpTs(ts)
    const u = toUsdtish(t)
    const sym = String(t?.tokenInfo?.tokenAbbr || t?.tokenAbbr || '').toUpperCase()
    if (t.to === a || t.from === a) {
      if (u > 0 && u < 1) dustIn++
      // Counterfeit USDT: "USDT" from any contract except the official one.
      if (sym === 'USDT') {
        const cc = String(t.contract_address || t.contractAddress || '')
        if (cc && cc !== USDT_TRON && cc.toLowerCase() !== USDT_TRON.toLowerCase()) fakeContracts.add(cc)
      }
    }
    if (t.to === a) {
      inCount++
      usdtIn += u
      if (t.from && t.from !== a) {
        const p = touch(t.from)
        p.txs++
        p.inN++
        p.usdtIn += u
      }
    }
    if (t.from === a) {
      outCount++
      usdtOut += u
      if (t.to && t.to !== a) {
        const p = touch(t.to)
        p.txs++
        p.outN++
        p.usdtOut += u
      }
    }
  }
  for (const t of transfers.trx) {
    const ts = t?.block_timestamp || t?.timestamp
    bumpTs(ts)
    const from = t?.ownerAddress || t?.from
    const to = t?.toAddress || t?.to
    if (to === a) {
      inCount++
      if (from && from !== a) touch(from).txs++, touch(from).inN++
    }
    if (from === a) {
      outCount++
      if (to && to !== a) touch(to).txs++, touch(to).outN++
    }
  }
  const txTotal = inCount + outCount
  const lifespanH = firstTs && lastTs ? Math.max((lastTs - firstTs) / 3600000, 0.01) : null

  // 2. Multi-hop exposure (BFS): counterparties vs OFAC lists.
  // No per-peer RPC (quota) — pure local list lookups.
  // Safeguards: visited set (no cycles), per-level caps, onProgress updates.
  const visited = new Set([a])
  const dirtyPeers = [] // { address, hop, source, label }
  const checkPeer = (peer, hop) => {
    // Canonical contracts (e.g. official USDT) are always clean.
    if (getCanonical(peer)) {
      visited.add(peer)
      return
    }
    if (visited.has(peer) || detectNetwork(peer) !== 'tron' || (!index && !community)) return
    visited.add(peer)
    if (index) {
      for (const key of lookupKeys(peer)) {
        const src = index[key]
        if (src) {
          dirtyPeers.push({ address: peer, hop, source: src, label: sourceLabel(src) })
          break
        }
      }
    }
    if (community) {
      for (const key of lookupKeys(peer)) {
        if (community[key]) {
          dirtyPeers.push({ address: peer, hop, source: 'COMMUNITY', label: `Жалоба сообщества: ${community[key]}` })
          break
        }
      }
    }
  }
  const collectPeers = (addr, tr) => {
    const map = new Map()
    const t2 = (x) => {
      if (!map.has(x)) map.set(x, { txs: 0 })
      return map.get(x)
    }
    for (const t of tr.trc20) {
      if (t.to === addr && t.from && t.from !== addr) t2(t.from).txs++
      if (t.from === addr && t.to && t.to !== addr) t2(t.to).txs++
    }
    for (const t of tr.trx) {
      const from = t?.ownerAddress || t?.from
      const to = t?.toAddress || t?.to
      if (to === addr && from && from !== addr) t2(from).txs++
      if (from === addr && to && to !== addr) t2(to).txs++
    }
    return map
  }
  for (const name of peers.keys()) checkPeer(name, 1)

  const depth = Math.min(5, Math.max(1, opts.depth || 1))
  const onProgress = opts.onProgress || (() => {})
  const CAPS = { 2: 20, 3: 20, 4: 12, 5: 8 } // per-level address budget (quota + time)
  const HOP_PTS = { 1: [25, 50], 2: [10, 30], 3: [5, 15], 4: [3, 10], 5: [2, 5] } // [per-hit, cap]
  const CONC = 4
  const pool = async (items, fn) => {
    let i = 0
    let done = 0
    const workers = Array.from({ length: Math.min(CONC, items.length) }, async () => {
      while (i < items.length) {
        const x = items[i++]
        try {
          await fn(x)
        } catch {
          /* one bad address must not kill the traversal */
        }
        done++
        onProgress({ stage: fn.stage, done, total: items.length })
      }
    })
    await Promise.all(workers)
  }
  let frontier = [...peers.entries()].sort((x, y) => y[1].txs - x[1].txs).map(([name]) => name)
  for (let hop = 2; hop <= depth; hop++) {
    const batch = frontier.slice(0, CAPS[hop])
    if (batch.length === 0) break
    const next = new Map()
    const stage = `Хоп ${hop}: проверяю ${batch.length} адресов…`
    const fn = async (peerAddr) => {
      const tr = await fetchTronTransfers(peerAddr)
      for (const [name, st] of collectPeers(peerAddr, tr)) {
        if (visited.has(name)) continue
        checkPeer(name, hop)
        if (!next.has(name)) next.set(name, { txs: 0 })
        next.get(name).txs += st.txs
      }
    }
    fn.stage = stage
    onProgress({ stage, done: 0, total: batch.length })
    await pool(batch, fn)
    frontier = [...next.entries()].sort((x, y) => y[1].txs - x[1].txs).map(([name]) => name)
  }

  // Security flags on top counterparties (shared Tronscan key — budgeted to top 8).
  const topForSec = [...peers.entries()]
    .sort((x, y) => y[1].usdtIn + y[1].usdtOut + y[1].txs - (x[1].usdtIn + x[1].usdtOut + x[1].txs))
    .slice(0, 8)
    .map(([name]) => name)
  if (topForSec.length > 0) {
    const stage = 'Флаги контрагентов (Tronscan)…'
    const secFn = async (peerAddr) => {
      const { flags } = await checkTronSecurity(peerAddr)
      for (const f of flags) {
        if (!dirtyPeers.some((d) => d.address === peerAddr && d.source === 'TRONSCAN_SEC_PEER')) {
          dirtyPeers.push({ address: peerAddr, hop: 1, source: 'TRONSCAN_SEC_PEER', label: f.label })
        }
      }
    }
    secFn.stage = stage
    onProgress({ stage, done: 0, total: topForSec.length })
    await pool(topForSec, secFn)
  }

  const HOP_NAMES = { 1: 'Прямые связи', 2: 'Связи 2-го хопа', 3: 'Связи 3-го хопа', 4: 'Связи 4-го хопа', 5: 'Связи 5-го хопа' }
  for (let hop = 1; hop <= 5; hop++) {
    const list = dirtyPeers.filter((d) => d.hop === hop && d.source !== 'TRONSCAN_SEC_PEER')
    if (list.length === 0) continue
    const [per, cap] = HOP_PTS[hop]
    const pts = Math.min(cap, list.length * per)
    score += pts
    add(pts, `${HOP_NAMES[hop]} с санкционными адресами: ${list.length}`, `OFAC SDN, вес падает с глубиной (+${per})`)
  }
  const secPeers = dirtyPeers.filter((d) => d.source === 'TRONSCAN_SEC_PEER')
  if (secPeers.length > 0) {
    const pts = Math.min(30, secPeers.length * 15)
    score += pts
    add(pts, `Флаги Tronscan у прямых контрагентов: ${secPeers.length}`, secPeers.map((d) => d.label).slice(0, 3).join('; '))
  }

  if (fakeContracts.size > 0) {
    score += 40
    add(40, `Поддельный USDT: переводы с левых контрактов (${fakeContracts.size})`, [...fakeContracts].slice(0, 2).join(', '))
  }
  if (dustIn >= 3) {
    score += 8
    add(8, `Пылевые входящие: ${dustIn}`, 'Переводы <1 USDT — признак dust-атак и спама')
  }

  // 3. Behavioral heuristics.
  if (ageDays !== null && ageDays < 3) {
    score += 15
    add(15, 'Кошелёк младше 3 дней', 'Свежие кошельки — классика дропов и скамов')
  } else if (ageDays !== null && ageDays < 30) {
    score += 8
    add(8, 'Кошелёк младше 30 дней', '')
  } else if (ageDays === null && txTotal === 0) {
    score += 12
    add(12, 'Нет истории', 'Адрес не активирован или пуст — уверенности мало')
  }
  if (txTotal > 0 && txTotal < 5) {
    score += 8
    add(8, 'Тонкая история (меньше 5 операций)', '')
  }
  if (lifespanH !== null && lifespanH < 24 && txTotal >= 6) {
    score += 10
    add(10, 'Высокая скорость: много операций за сутки', `${txTotal} оп. за ${lifespanH.toFixed(1)} ч`)
  }
  if (usdtIn > 0 && usdtOut / usdtIn > 0.9 && txTotal >= 4 && (lifespanH ?? 999) < 72) {
    score += 15
    add(15, 'Транзит: почти всё полученное ушло дальше', `Вышло ${Math.round((usdtOut / usdtIn) * 100)}% от вошедшего USDT`)
  }

  score = Math.min(100, Math.round(score))
  const level = score >= 51 ? 'high' : score >= 21 ? 'medium' : 'low'
  // Exposure: share of received USDT volume that came via sanctioned 1-hop peers.
  const dirtyUsdtIn = dirtyPeers
    .filter((d) => d.hop === 1 && d.source !== 'TRONSCAN_SEC_PEER')
    .reduce((s, d) => s + (peers.get(d.address)?.usdtIn || 0), 0)
  const exposurePct = usdtIn > 0 ? Math.round((dirtyUsdtIn / usdtIn) * 10000) / 100 : 0
  const topPeers = [...peers.entries()]
    .map(([address, st]) => ({ address, ...st, dirty: dirtyPeers.some((d) => d.address === address), canonical: getCanonical(address) }))
    .sort((x, y) => y.txs - x.txs)
    .slice(0, 10)

  return {
    score,
    level,
    depth,
    exposurePct,
    factors,
    stats: {
      ageDays: ageDays !== null ? Math.floor(ageDays) : null,
      txTotal,
      inCount,
      outCount,
      usdtIn: Math.round(usdtIn * 100) / 100,
      usdtOut: Math.round(usdtOut * 100) / 100,
      peers: peers.size,
      lifespanH: lifespanH !== null ? Math.round(lifespanH * 10) / 10 : null,
      dustIn,
      fakeContracts: [...fakeContracts],
    },
    dirtyPeers,
    topPeers,
    generatedAt: new Date().toISOString(),
  }
}

export const KYT_LEVEL = {
  low: { label: 'Низкий риск', cls: 'emerald' },
  medium: { label: 'Средний риск', cls: 'amber' },
  high: { label: 'Высокий риск', cls: 'red' },
}
