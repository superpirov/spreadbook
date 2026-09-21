import { doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

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
  const month = 30 * 24 * 60 * 60 * 1000
  const cur = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0
  const base = deltaMonths > 0 ? Math.max(Date.now(), cur) : cur || Date.now()
  const next = new Date(base + deltaMonths * month).toISOString()
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
