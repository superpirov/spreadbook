import { doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, query, where, limit, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'
import { makeRefCode } from './referral.js'

// Firestore user registry: collection "users", doc id = Firebase uid.
// Doc shape: { email, name, createdAt, lastSeen, trialStart, plan, planId,
//              txHash, paidAt, expiresAt }
// Local subscription state (zustand, localStorage) is a cache — cloud wins
// when it has billing data. If Firestore is not enabled, everything throws
// and callers fall back to local-only mode.

const usersCol = () => collection(db, 'users')
const userDoc = (uid) => doc(db, 'users', uid)

export async function ensureUserDoc(user) {
  const ref = userDoc(user.id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      name: user.name || '',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      trialStart: new Date().toISOString(),
      plan: 'trial',
      planId: null,
      txHash: null,
      paidAt: null,
      expiresAt: null,
      updatedAt: serverTimestamp(),
    })
    return null // fresh doc, nothing to adopt
  }
  await updateDoc(ref, { email: user.email, name: user.name || '', lastSeen: new Date().toISOString() })
  return snap.data()
}

export async function saveSubToCloud(uid, sub) {
  await updateDoc(userDoc(uid), {
    plan: sub.plan,
    planId: sub.planId || null,
    trialStart: sub.trialStart,
    txHash: sub.txHash || null,
    paidAt: sub.paidAt || null,
    expiresAt: sub.expiresAt || null,
    updatedAt: serverTimestamp(),
  })
}

// --- Admin operations (Firestore rules allow only ADMIN_EMAILS) ---

export async function fetchAllUsers() {
  const snap = await getDocs(usersCol())
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

// Add (delta > 0) or remove (delta < 0) months of PRO, free of charge.
// Adding extends from max(now, current expiry) and forces plan='pro'.
// Returns the new expiresAt ISO string.
export async function adjustMonths(uid, currentExpiresAt, deltaMonths) {
  return adjustTime(uid, currentExpiresAt, deltaMonths * 30 * 24 * 60 * 60 * 1000)
}

// Same in days (e.g. ±7 for a week).
export async function adjustDays(uid, currentExpiresAt, deltaDays) {
  return adjustTime(uid, currentExpiresAt, deltaDays * 24 * 60 * 60 * 1000)
}

async function adjustTime(uid, currentExpiresAt, deltaMs) {
  const cur = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0
  const base = deltaMs > 0 ? Math.max(Date.now(), cur) : cur || Date.now()
  const next = new Date(base + deltaMs).toISOString()
  await updateDoc(userDoc(uid), {
    plan: 'pro',
    expiresAt: next,
    updatedAt: serverTimestamp(),
  })
  return next
}

export async function setPlanPro(uid, expiresAt, note = '') {
  await updateDoc(userDoc(uid), { plan: 'pro', expiresAt, updatedAt: serverTimestamp(), adminNote: note || null })
}

// Ban / unban: banned users see a blocked screen instead of the cabinet
// (takes effect on their next login/refresh).
export async function setBanned(uid, banned) {
  await updateDoc(userDoc(uid), { banned: !!banned, updatedAt: serverTimestamp() })
}

// Admin inspection: full deal list of any user (rules allow admin reads).
export async function fetchUserDeals(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'deals'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// --- Used payment TX registry (double-spend protection) ---
// payments/{txHash}: { uid, planId, amount, txTime, createdAt }.
// Rules allow create ONLY if the doc does not exist yet (!exists) —
// the first claimant wins, replays are rejected at the database level.

export async function reserveTxHash(txHash, { uid, planId, amount, txTime }) {
  const hash = String(txHash || '').trim()
  if (!hash || !uid) throw new Error('Пустой хеш или пользователь.')
  try {
    await setDoc(doc(db, 'payments', hash), {
      uid,
      planId: planId || null,
      amount: Number(amount) || 0,
      txTime: txTime || null,
      createdAt: new Date().toISOString(),
    })
  } catch (e) {
    if (e?.code === 'permission-denied') {
      throw new Error('Этот хеш уже использован для активации. Один перевод — одна активация.')
    }
    throw new Error('Не удалось зарегистрировать платёж. Проверьте интернет и попробуйте ещё раз.')
  }
}
// --- Community scam reports (shared blacklist with admin moderation) ---
// Collection "reports": { address, network, reason, reporter, status, createdAt }.
// status: pending | approved | rejected. Approved entries merge into every
// user's local screening index (see aml.js community helpers).

const reportsCol = () => collection(db, 'reports')

export async function submitReport({ address, network, reason, reporter }) {
  const clean = String(address || '').trim()
  if (!clean) throw new Error('Пустой адрес')
  await addDoc(reportsCol(), {
    address: clean,
    network: network || 'unknown',
    reason: String(reason || '').trim().slice(0, 500),
    reporter: reporter || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
}

export async function fetchReports(status = 'pending') {
  // No orderBy: where+orderBy on different fields would require a composite
  // index. Sort client-side instead.
  const q = query(reportsCol(), where('status', '==', status), limit(200))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

export async function moderateReport(id, status) {
  if (!['approved', 'rejected'].includes(status)) return
  await updateDoc(doc(db, 'reports', id), { status, updatedAt: serverTimestamp() })
}

export async function deleteReport(id) {
  await deleteDoc(doc(db, 'reports', id))
}

// --- Referrals ---
// refcodes/{code}: { uid } — public read (auth), owner-only write.
// referrals/{autoId}: { code, referrerUid, refereeUid, refereeEmail,
//   status: signed_up|paid, claimed, createdAt, paidAt }.
// Read/update: only the referrer. Create: the referee themselves.
// The PRO bonus is CLAIMED by the referrer (writes own user doc) — no server.

export async function fetchApprovedReports() {
  return fetchReports('approved')
}

const refcodesCol = () => collection(db, 'refcodes')
const referralsCol = () => collection(db, 'referrals')

export async function ensureRefCode(uid) {
  const code = makeRefCode(uid)
  const ref = doc(db, 'refcodes', code)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { uid, createdAt: new Date().toISOString() })
  }
  return code
}

export async function resolveRefCode(code) {
  const clean = String(code || '').trim().toUpperCase()
  if (!clean) return null
  const snap = await getDoc(doc(db, 'refcodes', clean))
  if (!snap.exists()) return null
  return { code: clean, uid: snap.data()?.uid || null }
}

export async function createReferral({ code, referrerUid, refereeUid, refereeEmail }) {
  if (!referrerUid || !refereeUid || referrerUid === refereeUid) return null
  // One referral per referee (idempotent).
  const existing = await getDocs(query(referralsCol(), where('refereeUid', '==', refereeUid), limit(5)))
  if (!existing.empty) return null
  const ref = await addDoc(referralsCol(), {
    code,
    referrerUid,
    refereeUid,
    refereeEmail: refereeEmail || '',
    status: 'signed_up',
    claimed: false,
    createdAt: new Date().toISOString(),
    paidAt: null,
  })
  return ref.id
}

export async function fetchMyReferrals(uid) {
  const snap = await getDocs(query(referralsCol(), where('referrerUid', '==', uid), limit(200)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

// Called when the REFEREE pays: marks their referral row as paid.
// plan = { id, price } for the cash-bonus math.
export async function markReferralPaid(refereeUid, plan = null) {
  const snap = await getDocs(query(referralsCol(), where('refereeUid', '==', refereeUid), limit(5)))
  if (snap.empty) return false
  // Referee can update own row (rules allow: refereeUid == auth.uid).
  const patch = { status: 'paid', paidAt: new Date().toISOString() }
  if (plan) {
    patch.planId = plan.id || null
    patch.price = Number(plan.price) || 0
  }
  await updateDoc(snap.docs[0].ref, patch)
  return true
}

// Called by the REFERRER to collect +N days PRO. Writes own user doc.
export async function claimReferralBonus(referrerUid, referralId, currentExpiresAt, bonusDays) {
  const ref = doc(db, 'referrals', referralId)
  const snap = await getDoc(ref)
  const data = snap.data()
  if (!data || data.referrerUid !== referrerUid || data.status !== 'paid' || data.claimed) {
    throw new Error('Бонус недоступен (уже забран или нет оплаты).')
  }
  const base = Math.max(Date.now(), currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0)
  const next = new Date(base + bonusDays * 24 * 60 * 60 * 1000).toISOString()
  await updateDoc(userDoc(referrerUid), {
    plan: 'pro',
    expiresAt: next,
    updatedAt: serverTimestamp(),
  })
  await updateDoc(ref, { bonusType: 'days', claimed: true, claimedAt: new Date().toISOString() })
  return next
}

// Called by the REFERRER to take the cash bonus instead of days.
// Creates a payout request for the owner (manual USDT transfer).
export async function claimReferralCash(referrerUid, referralId, payoutWallet, cashPct) {
  const wallet = String(payoutWallet || '').trim()
  if (!wallet) throw new Error('Укажите кошелёк для выплаты.')
  const ref = doc(db, 'referrals', referralId)
  const snap = await getDoc(ref)
  const data = snap.data()
  if (!data || data.referrerUid !== referrerUid || data.status !== 'paid' || data.claimed || data.bonusType) {
    throw new Error('Бонус недоступен (уже забран или нет оплаты).')
  }
  const amount = Math.round((Number(data.price) || 0) * cashPct * 100) / 100
  await updateDoc(ref, {
    bonusType: 'cash',
    cashAmount: amount,
    cashStatus: 'pending',
    payoutWallet: wallet,
    claimedAt: new Date().toISOString(),
  })
  return amount
}

// --- Admin: cash payouts ---

export async function fetchCashPayouts() {
  const snap = await getDocs(query(referralsCol(), where('bonusType', '==', 'cash'), limit(200)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.claimedAt || 0) - new Date(a.claimedAt || 0))
}

export async function markPayoutPaid(id) {
  await updateDoc(doc(db, 'referrals', id), { cashStatus: 'paid', paidOutAt: new Date().toISOString() })
}
