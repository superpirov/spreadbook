export function formatMoney(value, currency = '') {
  const n = Number(value) || 0
  const str = n.toLocaleString('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
  return currency ? `${str} ${currency}` : str
}

export function formatSigned(value, currency = '') {
  const n = Number(value) || 0
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatMoney(n, currency)}`
}

export function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

export function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ru-RU')
  } catch {
    return String(iso)
  }
}

export function toLocalInputValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const ASSETS = ['USDT', 'BTC', 'ETH', 'SOL', 'TON', 'TRX', 'BNB']
export const FIATS = ['RUB', 'UAH', 'KZT', 'USD', 'TRY']
export const PLATFORMS = ['Bybit', 'Binance', 'Tinkoff', 'Sber', 'Cash', 'Other']
