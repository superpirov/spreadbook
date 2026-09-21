import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
export const AUTH_MODE = 'local' // 'local' | 'firebase' (wiring pending)

export const useAuth = create(
  persist(
    (set) => ({
      user: null, // { email, name, createdAt }

      login: (email, name = '') => {
        const clean = String(email || '').trim().toLowerCase()
        if (!clean || !clean.includes('@')) return false
        set({
          user: {
            email: clean,
            name: String(name || '').trim() || clean.split('@')[0],
            createdAt: new Date().toISOString(),
          },
        })
        return true
      },

      logout: () => set({ user: null }),
    }),
    { name: 'spreadbook-auth-v1', partialize: (s) => ({ user: s.user }) },
  ),
)
