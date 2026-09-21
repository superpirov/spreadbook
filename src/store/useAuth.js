import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../utils/firebase.js'
import { getPlan } from '../utils/billing.js'
import { ensureUserDoc, saveSubToCloud } from '../utils/users.js'
import { useStore } from './useStore.js'

// Real Firebase Authentication (email/password).
// Trial/pro subscription is keyed by Firebase uid, so different users on one
// browser don't share billing state. Pre-Firebase local trials are migrated
// by email once (see readLegacyTrial).
export const AUTH_MODE = 'firebase'

const DAY = 24 * 60 * 60 * 1000

const freshSub = () => ({
  plan: 'trial',
  trialStart: new Date().toISOString(),
  txHash: null,
  paidAt: null,
  expiresAt: null,
})

const toUser = (fb) => ({
  id: fb.uid,
  email: fb.email || '',
  name: fb.displayName || (fb.email || '').split('@')[0],
})

// Adopt cloud billing state into the local cache (cloud wins when it has data).
function adoptCloud(s, uid, cloud) {
  if (!cloud) return s
  const local = s.subs[uid]
  const merged = {
    plan: cloud.plan || local?.plan || 'trial',
    planId: cloud.planId || local?.planId || null,
    // Earliest trial start wins (never shorten an existing trial silently).
    trialStart: earliest(local?.trialStart, cloud.trialStart) || new Date().toISOString(),
    txHash: cloud.txHash || local?.txHash || null,
    paidAt: cloud.paidAt || local?.paidAt || null,
    expiresAt: cloud.expiresAt || local?.expiresAt || null,
  }
  return { subs: { ...s.subs, [uid]: merged } }
}

function earliest(a, b) {
  if (a && b) return new Date(a) < new Date(b) ? a : b
  return a || b || null
}

// Sync user doc with Firestore in background (no-op when Firestore/rules fail).
async function syncCloud(user, get, set) {
  try {
    const cloud = await ensureUserDoc(user)
    if (cloud) set((s) => adoptCloud(s, user.id, cloud))
  } catch {
    /* local-only mode */
  }
}
function readLegacyTrial(email) {
  try {
    const raw = localStorage.getItem('spreadbook-auth-v1')
    const data = JSON.parse(raw)?.state
    if (data?.user?.email === String(email).toLowerCase() && data?.sub?.trialStart) return data.sub
    return null
  } catch {
    return null
  }
}

let listenerStarted = false

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null, // { id (firebase uid), email, name }
      subs: {}, // { [uid]: { plan, trialStart, txHash, paidAt, expiresAt } }
      authReady: false,

      // Call once at startup (main.jsx). Keeps `user` in sync with Firebase.
      initListener: () => {
        if (listenerStarted) return
        listenerStarted = true
        onAuthStateChanged(auth, (fb) => {
          if (!fb) {
            useStore.getState().unbindUser()
            set({ user: null, authReady: true })
            return
          }
          const user = toUser(fb)
          const s = get()
          if (!s.subs[user.id]) {
            set({
              user,
              subs: { ...s.subs, [user.id]: readLegacyTrial(user.email) || freshSub() },
              authReady: true,
            })
          } else {
            set({ user, authReady: true })
          }
          useStore.getState().bindUser(user.id)
          syncCloud(user, get, set)
        })
      },

      register: async (email, name, password) => {
        const clean = String(email || '').trim().toLowerCase()
        const cred = await createUserWithEmailAndPassword(auth, clean, password)
        const displayName = String(name || '').trim() || clean.split('@')[0]
        await updateProfile(cred.user, { displayName })
        const s = get()
        const user = { id: cred.user.uid, email: clean, name: displayName }
        set({
          user,
          subs: { ...s.subs, [cred.user.uid]: s.subs[cred.user.uid] || readLegacyTrial(clean) || freshSub() },
        })
        useStore.getState().bindUser(user.id)
        syncCloud(user, get, set)
      },

      login: async (email, password) => {
        const clean = String(email || '').trim().toLowerCase()
        const cred = await signInWithEmailAndPassword(auth, clean, password)
        const user = toUser(cred.user)
        const s = get()
        set({
          user,
          subs: { ...s.subs, [user.id]: s.subs[user.id] || readLegacyTrial(clean) || freshSub() },
        })
        useStore.getState().bindUser(user.id)
        syncCloud(user, get, set)
      },

      resetPassword: (email) => sendPasswordResetEmail(auth, String(email || '').trim()),

      logout: async () => {
        useStore.getState().unbindUser()
        await signOut(auth)
        set({ user: null })
      },

      activatePro: async (txHash, plan = getPlan('monthly')) => {
        const s = get()
        if (!s.user) return
        const id = s.user.id
        const cur = s.subs[id] || freshSub()
        const next = {
          ...cur,
          plan: 'pro',
          planId: plan.id,
          txHash,
          paidAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + plan.days * DAY).toISOString(),
        }
        set({ subs: { ...s.subs, [id]: next } })
        try {
          await saveSubToCloud(id, next)
        } catch {
          /* local cache kept; cloud sync retries on next login */
        }
      },
    }),
    {
      name: 'spreadbook-auth-v2',
      partialize: (s) => ({ user: s.user, subs: s.subs }),
    },
  ),
)

// Subscription of the currently logged-in user (null when logged out).
export const useCurrentSub = () => useAuth((s) => (s.user ? s.subs[s.user.id] : null))
