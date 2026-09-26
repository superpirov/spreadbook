// Billing: 3-day free trial + paid USDT (TRC-20) subscription.
//
// Subscription state lives in Firestore (mirrored to localStorage cache,
// see useAuth + users.js) so the owner can manage subscriptions from the
// admin panel. A tech-savvy user can bypass local checks via devtools —
// owner can manage subscriptions from the admin panel. A tech-savvy user can
// bypass local checks via devtools — for strict enforcement a backend webhook
// (e.g. Firebase Function checking Trongrid) is needed later. The on-chain TX
// check below is real verification against Tronscan public API.

export const BILLING = {
  wallet: 'TQquJdaR7a5FZgJcikHKTYsB2fJeQVoHSN',
  network: 'TRC-20',
  asset: 'USDT',
  trialDays: 3,
}

// id, price in USDT, duration in days. Change prices/durations here only.
export const PLANS = [
  { id: 'monthly', title: 'PRO на месяц', price: 19, days: 30, perMonth: 19 },
  { id: 'yearly', title: 'PRO на год', price: 132, days: 365, perMonth: 11, badge: 'выгодно −42%' },
]

export const getPlan = (id) => PLANS.find((p) => p.id === id) || PLANS[0]

export const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
// Payment TX must be this fresh (days). Kills reuse of ancient transfers.
export const TX_MAX_AGE_DAYS = 7
const DAY = 24 * 60 * 60 * 1000

export function getAccessState(sub) {
  const now = Date.now()
  if (sub?.plan === 'pro' && sub?.expiresAt && new Date(sub.expiresAt).getTime() > now) {
    return { status: 'pro', daysLeft: Math.ceil((new Date(sub.expiresAt).getTime() - now) / DAY) }
  }
  if (sub?.trialStart) {
    const left = Math.ceil((new Date(sub.trialStart).getTime() + BILLING.trialDays * DAY - now) / DAY)
    if (left > 0) return { status: 'trial', daysLeft: left }
  }
  return { status: 'expired', daysLeft: 0 }
}

export function trialEndDate(sub) {
  if (!sub?.trialStart) return null
  return new Date(new Date(sub.trialStart).getTime() + BILLING.trialDays * DAY)
}

// Verify a USDT TRC-20 payment by TXID via Tronscan public API.
// Throws with a human-readable (Russian) message when anything is off.
export async function verifyUsdtPayment(txHash, planId = 'monthly') {
  const plan = getPlan(planId)
  const hash = String(txHash || '').trim()
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('TXID должен состоять из 64 hex-символов (0-9, a-f). Скопируйте хеш из кошелька или Tronscan.')
  }

  let res
  try {
    res = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${hash}`)
  } catch {
    throw new Error('Не удалось опросить сеть Tron. Проверьте интернет и попробуйте ещё раз.')
  }
  if (!res.ok) throw new Error('Tronscan временно недоступен. Попробуйте позже.')

  const j = await res.json()
  if (!j || j.id == null) {
    throw new Error('Транзакция с таким хешем не найдена. Проверьте TXID и сеть (нужна TRC-20).')
  }

  const confirmed = j.confirmed === true || (j.confirmations ?? 0) > 0 || j.block != null
  if (!confirmed) throw new Error('Транзакция найдена, но ещё не подтверждена сетью. Подождите пару минут.')

  // Recency: reject ancient transfers (limits replay of old payments).
  const ts = Number(j.timestamp ?? j.block_timestamp ?? j.blockTimestamp)
  let txDate = null
  if (Number.isFinite(ts) && ts > 0) {
    txDate = new Date(ts)
    if (Date.now() - ts > TX_MAX_AGE_DAYS * DAY) {
      throw new Error(`Транзакция старше ${TX_MAX_AGE_DAYS} дней — для оплаты сделайте свежий перевод.`)
    }
  }

  // Collect candidate TRC-20 transfers from all known response shapes.
  const candidates = []
  const push = (to, amountRaw, contract) => {
    if (to || amountRaw) candidates.push({ to, amountRaw, contract })
  }
  if (j.contractData) push(j.contractData.to_address, j.contractData.amount, j.contractData.contract_address || j.contract_address)
  if (j.tokenTransferInfo) push(j.tokenTransferInfo.to_address, j.tokenTransferInfo.amount_str ?? j.tokenTransferInfo.amount, j.tokenTransferInfo.contract_address)
  const list = j.trc20TransferInfo || j.trc20_transfer_info
  if (Array.isArray(list)) for (const t of list) push(t.to_address, t.amount_str ?? t.amount, t.contract_address)

  const need = plan.price * 1e6 // USDT has 6 decimals
  const match = candidates.find((c) => {
    const to = String(c.to || '')
    const isUsdt = String(c.contract || '').toLowerCase() === USDT_TRC20_CONTRACT.toLowerCase()
    const amount = Number(c.amountRaw)
    return to === BILLING.wallet && isUsdt && amount >= need
  })

  if (!match) {
    throw new Error(
      `Подходящий перевод не найден: нужен перевод ${plan.price} ${BILLING.asset} (${BILLING.network}) на адрес ${BILLING.wallet}. Проверьте сумму, токен и сеть.`,
    )
  }
  return { amount: Number(match.amountRaw) / 1e6, timestamp: txDate ? txDate.toISOString() : null }
}

export function tronscanUrl(hash) {
  return `https://tronscan.org/#/transaction/${hash}`
}
