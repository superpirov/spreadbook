// Pure calculation helpers for deals analytics.
// NOTE: MVP uses a simplified cash-flow model, NOT exact accounting P&L with
// asset revaluation / FIFO / LIFO.
//   buy  -> fiat outflow  (+fee)
//   sell -> fiat inflow   (-fee)
//   netCashFlow = sum(sells) - sum(buys)
// If netCashFlow > 0 and all assets are sold, it approximates profit.
// For open positions this is unrealized/cash-flow only — see README notes.

export function dealFiatTotal(deal) {
  const qty = Number(deal.amount) || 0
  const price = Number(deal.price) || 0
  return qty * price
}

// Final deal value for balance: buy costs more with fee, sell nets less with fee.
export function dealNetValue(deal) {
  const total = dealFiatTotal(deal)
  const fee = Number(deal.fee) || 0
  return deal.type === 'buy' ? -(total + fee) : total - fee
}

export function filterByPeriod(deals, period) {
  if (!period || period === 'all') return deals
  const now = new Date()
  const from = new Date(now)
  if (period === 'day') from.setDate(now.getDate() - 1)
  if (period === 'week') from.setDate(now.getDate() - 7)
  if (period === 'month') from.setMonth(now.getMonth() - 1)
  if (period === 'year') from.setFullYear(now.getFullYear() - 1)
  return deals.filter((d) => new Date(d.datetime) >= from)
}

export function calcVolume(deals) {
  return deals.reduce((sum, d) => sum + dealFiatTotal(d), 0)
}

export function calcNetProfit(deals) {
  const sells = deals
    .filter((d) => d.type === 'sell')
    .reduce((s, d) => s + dealFiatTotal(d) - (Number(d.fee) || 0), 0)
  const buys = deals
    .filter((d) => d.type === 'buy')
    .reduce((s, d) => s + dealFiatTotal(d) + (Number(d.fee) || 0), 0)
  return sells - buys
}

export function calcFees(deals) {
  return deals.reduce((s, d) => s + (Number(d.fee) || 0), 0)
}

export function calcAvgPrices(deals) {
  const buys = deals.filter((d) => d.type === 'buy')
  const sells = deals.filter((d) => d.type === 'sell')
  const avg = (list) => {
    const qty = list.reduce((s, d) => s + (Number(d.amount) || 0), 0)
    const fiat = list.reduce((s, d) => s + dealFiatTotal(d), 0)
    return qty > 0 ? fiat / qty : 0
  }
  return { avgBuy: avg(buys), avgSell: avg(sells) }
}

export function calcROI(deals) {
  const buys = deals
    .filter((d) => d.type === 'buy')
    .reduce((s, d) => s + dealFiatTotal(d) + (Number(d.fee) || 0), 0)
  if (buys <= 0) return 0
  return (calcNetProfit(deals) / buys) * 100
}

// Cumulative profit curve grouped by day: [{ date, profit, volume }]
export function buildEquityCurve(deals) {
  const sorted = [...deals].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  const byDay = new Map()
  for (const d of sorted) {
    const key = new Date(d.datetime).toISOString().slice(0, 10)
    const prev = byDay.get(key) || { profit: 0, volume: 0 }
    byDay.set(key, {
      profit: prev.profit + dealNetValue(d),
      volume: prev.volume + dealFiatTotal(d),
    })
  }
  let acc = 0
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => {
      acc += v.profit
      return { date: date.slice(5), fullDate: date, profit: Math.round(acc * 100) / 100, volume: v.volume }
    })
}

export function groupByPlatform(deals) {
  const map = new Map()
  for (const d of deals) {
    const key = d.platform || 'Other'
    map.set(key, (map.get(key) || 0) + dealFiatTotal(d))
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
}

export function groupByPair(deals) {
  const map = new Map()
  for (const d of deals) {
    const key = `${d.asset}/${d.fiat}`
    map.set(key, (map.get(key) || 0) + dealFiatTotal(d))
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

// Average spread per counterparty: weighted avg sell vs weighted avg buy,
// per asset + volume-weighted total. Null avg = no closed pairs yet.
export function counterpartySpread(deals) {
  const byAsset = new Map()
  for (const d of deals) {
    if (!byAsset.has(d.asset)) {
      byAsset.set(d.asset, { buyQty: 0, buySum: 0, sellQty: 0, sellSum: 0, vol: 0 })
    }
    const e = byAsset.get(d.asset)
    const qty = Number(d.amount) || 0
    const total = dealFiatTotal(d)
    e.vol += total
    if (d.type === 'buy') {
      e.buyQty += qty
      e.buySum += total
    } else {
      e.sellQty += qty
      e.sellSum += total
    }
  }
  const perAsset = []
  let wSum = 0
  let wVol = 0
  for (const [asset, e] of byAsset) {
    if (e.buyQty > 0 && e.sellQty > 0 && e.buySum > 0) {
      const sp = (e.sellSum / e.sellQty - e.buySum / e.buyQty) / (e.buySum / e.buyQty) * 100
      perAsset.push({ asset, spread: Math.round(sp * 100) / 100, vol: e.vol })
      wSum += sp * e.vol
      wVol += e.vol
    }
  }
  perAsset.sort((x, y) => y.vol - x.vol)
  return { perAsset, avg: wVol > 0 ? Math.round((wSum / wVol) * 100) / 100 : null }
}
