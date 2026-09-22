import bs58 from 'bs58'

// Local AML screening engine.
//
// Data: OFAC SDN digital-currency lists (0xB10C repo, `lists` branch,
// auto-updated nightly). Fetched as plain TXT (one address per line) from
// raw.githubusercontent.com (CORS-enabled) and cached in localStorage.
// Live Tether freeze state is queried on-chain (no API keys needed).
// Explorer labels (Etherscan/Tronscan "Phishing" etc.) have no free API
// and can't be pulled programmatically — UI links to them for manual check.

const OFAC_BASE = 'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists'

export const AML_SOURCES = [
  { id: 'TRX', file: 'sanctioned_addresses_TRX.txt', net: 'tron', label: 'OFAC SDN · TRON' },
  { id: 'ETH', file: 'sanctioned_addresses_ETH.txt', net: 'evm', label: 'OFAC SDN · Ethereum' },
  { id: 'USDT', file: 'sanctioned_addresses_USDT.txt', net: 'evm', label: 'OFAC SDN · USDT' },
  { id: 'USDC', file: 'sanctioned_addresses_USDC.txt', net: 'evm', label: 'OFAC SDN · USDC' },
  { id: 'BSC', file: 'sanctioned_addresses_BSC.txt', net: 'evm', label: 'OFAC SDN · BSC' },
  { id: 'XBT', file: 'sanctioned_addresses_XBT.txt', net: 'btc', label: 'OFAC SDN · Bitcoin' },
  { id: 'LTC', file: 'sanctioned_addresses_LTC.txt', net: 'ltc', label: 'OFAC SDN · Litecoin' },
  { id: 'SOL', file: 'sanctioned_addresses_SOL.txt', net: 'sol', label: 'OFAC SDN · Solana' },
]

const CACHE_KEY = 'spreadbook-aml-v1'
export const TRIAL_CHECKS_PER_DAY = 3

export const USDT_ETH = '0xdAC17F958D2e523B2EE19B794B234232B16a0b7383Cc'.toLowerCase()
export const USDT_TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const IS_BLACKLISTED_SELECTOR = '0xe47d6060'

// --- address utils ---

export function detectNetwork(raw) {
  const a = String(raw || '').trim()
  if (/^T[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return 'tron'
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'evm'
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(a)) return 'btc'
  if (/^(ltc1|[LM])[a-zA-HJ-NP-Z0-9]{25,60}$/.test(a)) return 'ltc'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'sol'
  return 'unknown'
}

const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (h) => Uint8Array.from(String(h).match(/../g).map((x) => parseInt(x, 16)))

export function tronToHex(base58Addr) {
  try {
    const bytes = bs58.decode(String(base58Addr).trim())
    // 25 bytes = 0x41 prefix + 20 address bytes + 4 checksum bytes;
    // 21 bytes = same without checksum.
    if (bytes[0] !== 0x41) return null
    const payload = bytes.length === 25 ? bytes.slice(0, 21) : bytes.length === 21 ? bytes : null
    if (!payload) return null
    return toHex(payload)
  } catch {
    return null
  }
}

// All lookup keys an address should be searched by (cross-format).
export function lookupKeys(raw) {
  const a = String(raw || '').trim()
  const net = detectNetwork(a)
  if (net === 'evm') return [a.toLowerCase()]
  if (net === 'tron') {
    const keys = [a]
    const hex = tronToHex(a)
    if (hex) {
      keys.push(hex, '0x' + hex.slice(2).toLowerCase())
    }
    return keys
  }
  return [a]
}

export function extractAddresses(text) {
  const re = /T[1-9A-HJ-NP-Za-km-z]{25,34}|0x[a-fA-F0-9]{40}|(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}|(?:ltc1|[LM])[a-zA-HJ-NP-Z0-9]{25,60}/g
  return [...new Set(String(text || '').match(re) || [])]
}

// --- lists: fetch, cache, lookup ---

export function getCachedLists() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || typeof d.index !== 'object') return null
    return d // { updatedAt, counts, index: { key: sourceId } }
  } catch {
    return null
  }
}

export async function refreshLists() {
  const results = await Promise.allSettled(
    AML_SOURCES.map(async (s) => {
      const res = await fetch(`${OFAC_BASE}/${s.file}`)
      if (!res.ok) throw new Error(`${s.id}: HTTP ${res.status}`)
      const text = await res.text()
      return { id: s.id, lines: text.split('\n').map((l) => l.trim()).filter(Boolean) }
    }),
  )
  const index = {}
  const counts = {}
  const errors = []
  for (let i = 0; i < results.length; i++) {
    const src = AML_SOURCES[i]
    const r = results[i]
    if (r.status !== 'fulfilled') {
      errors.push(src.id)
      continue
    }
    let n = 0
    for (const line of r.value.lines) {
      for (const key of indexKeysForLine(line)) {
        if (!(key in index)) {
          index[key] = src.id
          n++
        }
      }
    }
    counts[src.id] = n
  }
  if (Object.keys(index).length === 0) throw new Error('Не удалось загрузить ни один список. Проверьте интернет.')
  // Merge with previous cache so a partially failed refresh never shrinks coverage.
  const prev = getCachedLists()
  const merged = { ...(prev?.index || {}), ...index }
  const data = { updatedAt: new Date().toISOString(), counts, index: merged, total: Object.keys(merged).length }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    /* storage full — keep in-memory use only */
  }
  return { ...data, errors }
}

function indexKeysForLine(line) {
  const keys = []
  if (/^0x[0-9a-fA-F]{40}$/.test(line)) {
    keys.push(line.toLowerCase())
  } else if (/^T[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(line)) {
    keys.push(line)
    const hex = tronToHex(line)
    if (hex) keys.push(hex, '0x' + hex.slice(2).toLowerCase())
  } else if (line) {
    keys.push(line)
  }
  return keys
}

export function sourceLabel(id) {
  if (id === 'TETHER_FROZEN') return 'Tether freeze (USDT)'
  return AML_SOURCES.find((s) => s.id === id)?.label || id
}

// Pure list lookup. Returns { network, verdict: 'bad'|'clean'|'unknown', matches }.
export function checkAddress(raw, index) {
  const addr = String(raw || '').trim()
  const network = detectNetwork(addr)
  if (network === 'unknown' || !index) {
    return { address: addr, network, verdict: 'unknown', matches: [] }
  }
  const found = []
  for (const key of lookupKeys(addr)) {
    const src = index[key]
    if (src && !found.includes(src)) found.push(src)
  }
  return {
    address: addr,
    network,
    verdict: found.length > 0 ? 'bad' : 'clean',
    matches: found.map((id) => ({ source: id, label: sourceLabel(id) })),
  }
}

// --- live Tether freeze state (on-chain, no keys) ---

async function ethCallFreeze(address) {
  const padded = address.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [{ to: USDT_ETH, data: IS_BLACKLISTED_SELECTOR + padded }, 'latest'],
  })
  const rpcs = [
    'https://ethereum.publicnode.com',
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com',
  ]
  const errors = []
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
      if (!res.ok) throw new Error(`${rpc}: HTTP ${res.status}`)
      const j = await res.json()
      const hex = String(j?.result || '')
      if (!/^0x[0-9a-f]*$/.test(hex) || hex.length < 2) throw new Error(`${rpc}: пустой ответ`)
      return { frozen: BigInt(hex) === 1n, error: null }
    } catch (e) {
      errors.push(e.message)
    }
  }
  return { frozen: null, error: errors.join('; ') }
}

async function tronCallFreezeOnce(endpoint, tAddress) {
  const hex = tronToHex(tAddress)
  if (!hex) return null
  // Canonical EVM ABI encoding: 20-byte address (no 0x41 prefix), left-padded.
  const param = hex.replace(/^41/, '').padStart(64, '0')
  let res
  try {
    res = await fetch(`${endpoint}/wallet/triggerconstantcontract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_address: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKLxmGkn', // any valid address (burn)
        contract_address: USDT_TRON,
        function_selector: 'isBlackListed(address)',
        parameter: param,
      }),
    })
  } catch {
    throw new Error(`${endpoint}: сеть/CORS`)
  }
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`)
  const j = await res.json()
  const out = j?.constant_result?.[0]
  if (!out) throw new Error(`${endpoint}: пустой ответ`)
  return BigInt('0x' + out) === 1n
}

async function tronCallFreeze(tAddress) {
  const errors = []
  for (const endpoint of ['https://api.trongrid.io', 'https://tron-rpc.publicnode.com']) {
    try {
      const v = await tronCallFreezeOnce(endpoint, tAddress)
      if (v !== null) return { frozen: v, error: null }
      errors.push(`${endpoint}: пустой ответ`)
    } catch (e) {
      errors.push(e.message)
    }
  }
  return { frozen: null, error: errors.join('; ') }
}

// { frozen: true|false|null, error: string|null }.
// null = unknown (offline/RPC down) — never treat as "clear".
export async function checkTetherFrozen(raw) {
  const net = detectNetwork(raw)
  if (net === 'evm') return ethCallFreeze(raw.trim())
  if (net === 'tron') return tronCallFreeze(raw.trim())
  return { frozen: null, error: null }
}

export function explorerUrl(raw) {
  const net = detectNetwork(raw)
  const a = String(raw).trim()
  if (net === 'tron') return `https://tronscan.org/#/address/${a}`
  if (net === 'evm') return `https://etherscan.io/address/${a}`
  if (net === 'btc') return `https://mempool.space/address/${a}`
  return null
}

export function checksUsedToday(history) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return (history || []).filter((h) => new Date(h.createdAt).getTime() >= start.getTime()).length
}
