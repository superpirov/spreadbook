// Quotes & intra-exchange triangular arbitrage scanner.
// PUBLIC market data only — no API keys needed (neither owner's nor users').
// Private/authenticated endpoints (P2P ads, trading) are NOT touched here:
// embedding exchange secrets in frontend JS would hand over the account.

export const EXCHANGES = [
  { id: 'bybit', name: 'Bybit' },
  { id: 'htx', name: 'HTX' },
  { id: 'mexc', name: 'MEXC' },
]

// Suffix match, longest first (ETHBTC -> ETH/BTC, not ETHB/TC).
const QUOTE_CURRENCIES = [
  'USDT', 'USDC', 'FDUSD', 'TUSD', 'USDD', 'DAI',
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'TRX',
  'USD', 'EUR', 'TRY', 'BRL', 'RUB', 'UAH',
].sort((a, b) => b.length - a.length)

export function splitSymbol(sym) {
  const s = String(sym || '').toUpperCase()
  for (const q of QUOTE_CURRENCIES) {
    if (s.length > q.length + 1 && s.endsWith(q)) {
      return { base: s.slice(0, -q.length), quote: q }
    }
  }
  return null
}

function norm({ exchange, symbol, price, bid, ask, changePct, volume }) {
  const parts = splitSymbol(symbol)
  if (!parts || !(price > 0)) return null
  return {
    exchange,
    symbol: `${parts.base}/${parts.quote}`,
    base: parts.base,
    quote: parts.quote,
    price,
    bid: bid > 0 ? bid : price,
    ask: ask > 0 ? ask : price,
    changePct: Number.isFinite(changePct) ? changePct : 0,
    volume: volume > 0 ? volume : 0, // quote-currency turnover (liquidity hint)
  }
}

const PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
]
const isProxy = (u) => u.includes('allorigins') || u.includes('codetabs')

// Try URLs in order (mirror hosts, then public CORS proxies). Throws last error.
async function getFirst(urls) {
  let lastErr = new Error('no urls')
  for (const u of urls) {
    // Proxies are slow — give them more time.
    const timeoutMs = isProxy(u) ? 25000 : 12000
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), timeoutMs)
    try {
      const res = await fetch(u, { signal: c.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      clearTimeout(t)
      return { data, viaProxy: isProxy(u) }
    } catch (e) {
      clearTimeout(t)
      lastErr = e?.name === 'AbortError' ? new Error('timeout') : e
    }
  }
  throw lastErr
}

const withProxies = (url) => [url, ...PROXIES.map((p) => p(url))]

async function fetchBybit() {
  const { data: j, viaProxy } = await getFirst(withProxies('https://api.bybit.com/v5/market/tickers?category=spot'))
  if (j.retCode !== 0) throw new Error(j.retMsg || 'Bybit error')
  const tickers = j.result.list
    .map((t) =>
      norm({
        exchange: 'bybit',
        symbol: t.symbol,
        price: Number(t.lastPrice),
        bid: Number(t.bid1Price),
        ask: Number(t.ask1Price),
        changePct: Number(t.price24hPcnt) * 100,
        volume: Number(t.turnover24h),
      }),
    )
    .filter(Boolean)
  return { tickers, viaProxy }
}

async function fetchHtx() {
  const path = '/market/tickers'
  const { data: j, viaProxy } = await getFirst([
    `https://api-aws.huobi.pro${path}`, // AWS CDN mirror (official)
    `https://api.huobi.pro${path}`,
    ...withProxies(`https://api.huobi.pro${path}`).slice(1),
  ])
  if (j.status !== 'ok') throw new Error(j.errmsg || 'HTX error')
  const tickers = j.data
    .map((d) =>
      norm({
        exchange: 'htx',
        symbol: d.symbol,
        price: Number(d.close),
        bid: Number(d.bid),
        ask: Number(d.ask),
        changePct: Number(d.open) > 0 ? ((Number(d.close) - Number(d.open)) / Number(d.open)) * 100 : 0,
        volume: Number(d.vol),
      }),
    )
    .filter(Boolean)
  return { tickers, viaProxy }
}

async function fetchMexc() {
  const url = 'https://api.mexc.com/api/v3/ticker/24hr'
  const { data: j, viaProxy } = await getFirst(withProxies(url))
  if (!Array.isArray(j)) throw new Error('MEXC error')
  const tickers = j
    .map((t) =>
      norm({
        exchange: 'mexc',
        symbol: t.symbol,
        price: Number(t.lastPrice),
        bid: Number(t.bidPrice),
        ask: Number(t.askPrice),
        changePct: Number(t.priceChangePercent),
        volume: Number(t.quoteVolume),
      }),
    )
    .filter(Boolean)
  return { tickers, viaProxy }
}

const FETCHERS = { bybit: fetchBybit, htx: fetchHtx, mexc: fetchMexc }

export async function fetchExchange(id) {
  return FETCHERS[id]()
}

// --- Triangular arbitrage ---
// Cycle base -> X -> Y -> base using bid/ask (taker side), fee per leg.
// Returns [{ path, legs, netPct, grossPct, volume }] sorted by netPct desc.

export function findTriangles(tickers, { base = 'USDT', fee = 0.001, minProfit = 0.3, minVolume = 0, limit = 30 } = {}) {
  const byPair = new Map()
  for (const t of tickers) byPair.set(`${t.base}/${t.quote}`, t)

  // Convert `amount` of `from` into `to`. Returns { amount, pair, side } or null.
  const leg = (amount, from, to) => {
    const direct = byPair.get(`${from}/${to}`) // selling `from` (base) for `to`
    if (direct && direct.bid > 0) {
      return { amount: amount * direct.bid * (1 - fee), pair: direct.symbol, side: 'sell', price: direct.bid }
    }
    const inverse = byPair.get(`${to}/${from}`) // buying `to` (base) with `from`
    if (inverse && inverse.ask > 0) {
      return { amount: (amount / inverse.ask) * (1 - fee), pair: inverse.symbol, side: 'buy', price: inverse.ask }
    }
    return null
  }

  const mids = [...new Set(tickers.filter((t) => t.quote === base).map((t) => t.base))]
  const out = []
  for (const x of mids) {
    for (const y of mids) {
      if (x === y) continue
      const l1 = leg(1, base, x)
      if (!l1) continue
      const l2 = leg(l1.amount, x, y)
      if (!l2) continue
      const l3 = leg(l2.amount, y, base)
      if (!l3) continue
      const netPct = (l3.amount - 1) * 100
      if (netPct < minProfit) continue
      const volumes = [
        byPair.get(`${x}/${base}`)?.volume ?? byPair.get(`${base}/${x}`)?.volume ?? 0,
        byPair.get(`${x}/${y}`)?.volume ?? byPair.get(`${y}/${x}`)?.volume ?? 0,
        byPair.get(`${y}/${base}`)?.volume ?? byPair.get(`${base}/${y}`)?.volume ?? 0,
      ]
      const minVol = Math.min(...volumes)
      if (minVol < minVolume) continue
      const gross = ((l3.amount / (1 - fee) ** 3 - 1) * 100)
      out.push({
        path: [base, x, y, base],
        legs: [
          { ...l1, from: base, to: x },
          { ...l2, from: x, to: y },
          { ...l3, from: y, to: base },
        ],
        netPct: Math.round(netPct * 100) / 100,
        grossPct: Math.round(gross * 100) / 100,
        volume: Math.round(minVol),
      })
    }
  }
  return out.sort((a, b) => b.netPct - a.netPct).slice(0, limit)
}
