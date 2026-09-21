import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mockDeals, mockRatings } from '../utils/mockData.js'

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// Single store: deals + counterparty ratings + UI prefs. Persisted to localStorage.
// No backend — this is the entire "database" for GitHub Pages build.
export const useStore = create(
  persist(
    (set, get) => ({
      deals: mockDeals,
      isDemo: false,
      ratings: mockRatings,
      knownCounterparties: [],
      profiles: {}, // { [name]: { wallets, cardNumber, phone, bank } }
      period: 'all',
      theme: 'dark',

      setPeriod: (period) => set({ period }),

      addDeal: (deal) =>
        set((s) => ({
          deals: [{ ...deal, id: deal.id || uid() }, ...s.deals],
        })),

      updateDeal: (id, patch) =>
        set((s) => ({
          deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),

      deleteDeal: (id) =>
        set((s) => ({
          deals: s.deals.filter((d) => d.id !== id),
        })),

      clearDemo: () => set({ deals: [], isDemo: false }),

      resetAll: () => set({ deals: [], ratings: {}, knownCounterparties: [], profiles: {}, isDemo: false }),

      // Import replaces the whole DB (with user confirmation in UI).
      importData: (payload) => {
        const deals = Array.isArray(payload?.deals) ? payload.deals : []
        const ratings = payload?.ratings && typeof payload.ratings === 'object' ? payload.ratings : {}
        const known = Array.isArray(payload?.knownCounterparties) ? payload.knownCounterparties : []
        const profiles = payload?.profiles && typeof payload.profiles === 'object' ? payload.profiles : {}
        set({ deals, ratings, knownCounterparties: known, profiles, isDemo: false })
      },

      setRating: (name, rating, note = '') =>
        set((s) => ({
          ratings: { ...s.ratings, [name]: { rating, note } },
        })),

      setProfile: (name, patch) =>
        set((s) => ({
          profiles: { ...s.profiles, [name]: { wallets: '', cardNumber: '', phone: '', bank: '', ...(s.profiles[name] || {}), ...patch } },
        })),

      // Explicitly added counterparties (without deals yet).
      addCounterparty: (name) => {
        const clean = String(name || '').trim()
        if (!clean) return false
        const exists = get()
          .counterparties()
          .some((c) => c.toLowerCase() === clean.toLowerCase())
        if (exists) return false
        set((s) => ({ knownCounterparties: [...s.knownCounterparties, clean] }))
        return true
      },

      removeCounterparty: (name) =>
        set((s) => ({
          knownCounterparties: s.knownCounterparties.filter((c) => c !== name),
        })),

      // Full delete: removes from known list, drops rating/profile, and
      // unlinks the name from existing deals (deals themselves are kept).
      deleteCounterparty: (name) =>
        set((s) => {
          const ratings = { ...s.ratings }
          delete ratings[name]
          const profiles = { ...s.profiles }
          delete profiles[name]
          return {
            knownCounterparties: s.knownCounterparties.filter((c) => c !== name),
            ratings,
            profiles,
            deals: s.deals.map((d) => (d.counterparty === name ? { ...d, counterparty: '' } : d)),
          }
        }),

      counterparties: () => {
        const fromDeals = get().deals.map((d) => (d.counterparty || '').trim()).filter(Boolean)
        const names = new Set([...fromDeals, ...get().knownCounterparties])
        return [...names].sort((a, b) => a.localeCompare(b, 'ru'))
      },
    }),
    {
      // v2: demo seed removed + knownCounterparties added. Old v1 persisted
      // demo data is intentionally dropped by the key change.
      name: 'spreadbook-storage-v2',
      partialize: (s) => ({
        deals: s.deals,
        ratings: s.ratings,
        knownCounterparties: s.knownCounterparties,
        profiles: s.profiles,
        isDemo: s.isDemo,
        period: s.period,
      }),
    },
  ),
)
