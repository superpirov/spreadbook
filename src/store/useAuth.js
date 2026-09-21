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
import { BILLING } from '../utils/billing.js'

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

// One-time migration of the old local-mode trial (spreadbook-auth-v1).
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
        })
      },

      register: async (email, name, password) => {
        const clean = String(email || '').trim().toLowerCase()
        const cred = await createUserWithEmailAndPassword(auth, clean, password)
        const displayName = String(name || '').trim() || clean.split('@')[0]
        await updateProfile(cred.user, { displayName })
        const s = get()
        set({
          user: { id: cred.user.uid, email: clean, name: displayName },
          subs: { ...s.subs, [cred.user.uid]: s.subs[cred.user.uid] || readLegacyTrial(clean) || freshSub() },
        })
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
      },

      resetPassword: (email) => sendPasswordResetEmail(auth, String(email || '').trim()),

      logout: async () => {
        await signOut(auth)
        set({ user: null })
      },

      activatePro: (txHash, periodDays = BILLING.periodDays) =>
        set((s) => {
          if (!s.user) return s
          const id = s.user.id
          const cur = s.subs[id] || freshSub()
          return {
            subs: {
              ...s.subs,
              [id]: {
                ...cur,
                plan: 'pro',
                txHash,
                paidAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + periodDays * DAY).toISOString(),
              },
            },
          }
        }),
    }),
    {
      name: 'spreadbook-auth-v2',
      partialize: (s) => ({ user: s.user, subs: s.subs }),
    },
  ),
)

// Subscription of the currently logged-in user (null when logged out).
export const useCurrentSub = () => useAuth((s) => (s.user ? s.subs[s.user.id] : null))
