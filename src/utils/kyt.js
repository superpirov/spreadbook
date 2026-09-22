import { lookupKeys, detectNetwork, sourceLabel } from './aml.js'

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

// Full deep check. self = { verdict, matches, frozen } from the quick engine.
// Returns report { score, level, factors[], stats, dirtyPeers[], generatedAt }.
export async function analyzeKyt(address, index, self) {
  const a = String(address).trim()
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
  const bumpTs = (ts) => {
    if (!ts) return
    if (!firstTs || ts < firstTs) firstTs = ts
    if (!lastTs || ts > lastTs) lastTs = ts
  }
  for (const t of transfers.trc20) {
    const ts = t?.block_timestamp || t?.timestamp
    bumpTs(ts)
    const u = toUsdtish(t)
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

  // 2. Direct exposure: counterparties vs OFAC lists (no per-peer RPC — quota).
  const dirtyPeers = []
  if (index) {
    for (const [peer, st] of peers) {
      if (detectNetwork(peer) !== 'tron') continue
      for (const key of lookupKeys(peer)) {
        const src = index[key]
        if (src) {
          dirtyPeers.push({ address: peer, source: src, label: sourceLabel(src), ...st })
          break
        }
      }
    }
  }
  if (dirtyPeers.length > 0) {
    const pts = Math.min(50, dirtyPeers.length * 25)
    score += pts
    add(pts, `Прямые связи с санкционными адресами: ${dirtyPeers.length}`, 'Контрагенты 1-го хопа из OFAC SDN')
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
  const topPeers = [...peers.entries()]
    .map(([address, st]) => ({ address, ...st, dirty: dirtyPeers.some((d) => d.address === address) }))
    .sort((x, y) => y.txs - x.txs)
    .slice(0, 10)

  return {
    score,
    level,
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
