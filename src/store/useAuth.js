import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BILLING } from '../utils/billing.js'

// Auth abstraction with a pluggable provider.
//
// CURRENT: 'local' provider — no backend (GitHub Pages static hosting cannot
// verify passwords by itself). Any email "logs in" and the profile is stored
// in localStorage. This is a UX gate for the cabinet, NOT real security.
//
// TO ENABLE REAL EMAIL LOGIN: add a 'firebase' provider (see AUTH_PLAN in
// README) — Firebase Authentication (email/password, Google) works fine with
// static hosting. Only this file + Login.jsx need to change; routes and
// ProtectedRoute stay untouched.
//
// SUBSCRIPTION: trial + pro live here too (client-side enforcement, see
// billing.js). Paid via USDT TRC-20 with on-chain TX verification.
export const AUTH_MODE = 'local' // 'local' | 'firebase' (wiring pending)

const freshSub = () => ({ plan: 'trial', trialStart: null, txHash: null, paidAt: null, expiresAt: null })

export const useAuth = create(
  persist(
    (set) => ({
      user: null, // { email, name, createdAt }
      sub: freshSub(),

      login: (email, name = '') => {
        const clean = String(email || '').trim().toLowerCase()
        if (!clean || !clean.includes('@')) return false
        set((s) => ({
          user: {
            email: clean,
            name: String(name || '').trim() || clean.split('@')[0],
            createdAt: s.user?.email === clean ? s.user.createdAt : new Date().toISOString(),
          },
          // Start the 3-day trial on first ever login.
          sub: s.sub?.trialStart ? s.sub : { ...freshSub(), trialStart: new Date().toISOString() },
        }))
        return true
      },

      logout: () => set({ user: null }),

      activatePro: (txHash, periodDays = BILLING.periodDays) =>
        set((s) => ({
          sub: {
            ...s.sub,
            plan: 'pro',
            txHash,
            paidAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString(),
          },
        })),
    }),
    { name: 'spreadbook-auth-v1', partialize: (s) => ({ user: s.user, sub: s.sub }) },
  ),
)
