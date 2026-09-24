import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase.js'

// Personal exchange API keys for P2P order books.
// NEVER embed owner secrets in frontend JS — each user pastes OWN keys,
// stored in their own Firestore subtree (owner-only rules) and used only
// from their own browser. Keys with minimal permissions (no withdrawals!).

export const P2P_EXCHANGES = [
  { id: 'bybit', name: 'Bybit', fields: ['apiKey', 'apiSecret'], hint: 'Нужен статус P2P-рекламодателя, иначе API вернёт ошибку. Только чтение P2P.' },
  { id: 'mexc', name: 'MEXC', fields: ['apiKey', 'apiSecret'], hint: 'Нужно право P2P Account Read. Вывод средств НЕ включать.' },
  { id: 'rapira', name: 'Rapira', fields: ['token'], hint: 'Bearer-токен с P2P-доступом из ЛК Rapira.' },
]

const exCol = (owner) => collection(db, 'users', owner, 'exkeys')

export async function loadExKeys(owner) {
  const snap = await getDocs(exCol(owner))
  const out = {}
  snap.docs.forEach((d) => {
    out[d.id] = d.data()
  })
  return out // { bybit: { apiKey, apiSecret, ... }, ... }
}

export async function saveExKey(owner, exchange, creds) {
  await setDoc(doc(db, 'users', owner, 'exkeys', exchange), { ...creds, updatedAt: new Date().toISOString() })
}

export async function deleteExKey(owner, exchange) {
  await deleteDoc(doc(db, 'users', owner, 'exkeys', exchange))
}

// --- signing (WebCrypto, HTTPS/localhost only) ---

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// --- P2P fetchers (fail-soft: throw Russian messages) ---

export async function fetchBybitP2P(creds, { token = 'USDT', fiat = 'RUB', side = '1', page = 1, size = 10 } = {}) {
  const body = { tokenId: token, currencyId: fiat, side: String(side), page: String(page), size: String(size) }
  const ts = String(Date.now())
  const sign = await hmacHex(creds.apiSecret, ts + creds.apiKey + '5000' + JSON.stringify(body))
  let res
  try {
    res = await fetch('https://api.bybit.com/v5/p2p/item/online', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAPI-API-KEY': creds.apiKey,
        'X-BAPI-TIMESTAMP': ts,
        'X-BAPI-RECV-WINDOW': '5000',
        'X-BAPI-SIGN': sign,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Bybit: сеть недоступна (проверьте интернет/VPN)')
  }
  const text = await res.text().catch(() => '')
  let j = null
  try {
    j = JSON.parse(text)
  } catch {
    /* non-JSON (geo-block page?) */
  }
  if (!j || j.retCode !== 0) {
    console.warn('[spreadbook] Bybit P2P raw:', text.slice(0, 300))
    if (!j) {
      throw new Error(`Bybit: не-JSON ответ (HTTP ${res.status}) — похоже на сетевую блокировку/гео-фильтр.`)
    }
    throw new Error(`Bybit [${j.retCode}]: ${j.retMsg || 'без описания'}. Проверьте ключ, P2P-права и статус рекламодателя.`)
  }
  return (j.result?.items || []).map((it) => ({
    id: String(it.id),
    merchant: it.nickName || '—',
    price: Number(it.price),
    min: Number(it.minAmount),
    max: Number(it.maxAmount),
    qty: Number(it.lastQuantity),
    payments: (it.payments || []).join(', '),
    orders: it.recentOrderNum ?? it.orderFinishNumberDay30 ?? '—',
    rate: it.recentExecuteRate ?? it.completeRateDay30 ?? '',
    online: it.isOnline !== false,
    tags: (it.authTag || []).join(','),
  }))
}

export async function fetchMexcP2P(creds, { coin = 'USDT', fiat = 'RUB', side = 'SELL' } = {}) {
  const params = { fiatUnit: fiat, coinId: coin, side, page: 1, limit: 10 }
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const ts = String(Date.now())
  const sign = await hmacHex(creds.apiSecret, `${qs}&timestamp=${ts}`)
  const url = `https://api.mexc.com/api/v3/fiat/market/ads/pagination?${qs}&timestamp=${ts}&signature=${sign}`
  let res
  try {
    res = await fetch(url, { headers: { 'X-MEXC-APIKEY': creds.apiKey } })
  } catch {
    throw new Error('MEXC: сеть недоступна')
  }
  const j = await res.json().catch(() => null)
  if (!j || j.code !== 0) {
    throw new Error(`MEXC: ${j?.msg || `HTTP ${res.status}`}. Проверьте ключ и право P2P Account Read.`)
  }
  return (j.data || []).map((ad) => ({
    id: String(ad.advNo),
    merchant: ad.merchant?.nickName || ad.makerInstitutionName || '—',
    price: Number(ad.price),
    min: Number(ad.minSingleTransAmount),
    max: Number(ad.maxSingleTransAmount),
    qty: Number(ad.availableQuantity),
    payments: ad.payMethod || '',
    orders: ad.merchantStatistics?.totalBuyCount + ad.merchantStatistics?.totalSellCount || ad.exchangeCount || '—',
    rate: ad.merchantStatistics?.completeRate ? `${(Number(ad.merchantStatistics.completeRate) * 100).toFixed(1)}%` : '',
    online: true,
    tags: ad.tags || '',
  }))
}

export async function fetchRapiraP2P(creds, { base = 'USDT', fiat = 'RUB', side = 'SELL' } = {}) {
  const body = {
    merchantSide: side,
    amount: null,
    internalCoinUnit: base,
    externalCoinUnit: fiat,
    showOnlyRecommended: false,
    pageNo: 1,
    pageSize: 20,
  }
  let res
  try {
    res = await fetch('https://api.rapira.net/open/otc/ad/page-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Rapira: сеть недоступна')
  }
  const j = await res.json().catch(() => null)
  const items = j?.content || j?.data || j?.ads || null
  if (!items) {
    throw new Error(`Rapira: ${j?.message || `HTTP ${res.status}`}. Проверьте токен и P2P-доступ.`)
  }
  return items.map((ad, i) => ({
    id: String(ad.offerId || ad.adId || ad.id || i),
    merchant: ad.merchant?.username || ad.username || '—',
    price: Number(ad.price),
    min: Number(ad.minLimit),
    max: Number(ad.maxLimit),
    qty: Number(ad.quantity),
    payments: (ad.paymentTypes || []).map((p) => p.paymentName).join(', '),
    orders: ad.merchant?.totalCompletedCount ?? '—',
    rate: ad.merchant?.totalCompletedPercent ? `${ad.merchant.totalCompletedPercent}%` : '',
    online: true,
    tags: '',
  }))
}

export const P2P_FETCHERS = { bybit: fetchBybitP2P, mexc: fetchMexcP2P, rapira: fetchRapiraP2P }
