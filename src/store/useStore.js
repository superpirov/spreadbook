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
      isDemo: true,
      ratings: mockRatings,
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

      resetAll: () => set({ deals: [], ratings: {}, isDemo: false }),

      // Import replaces the whole DB (with user confirmation in UI).
      importData: (payload) => {
        const deals = Array.isArray(payload?.deals) ? payload.deals : []
        const ratings = payload?.ratings && typeof payload.ratings === 'object' ? payload.ratings : {}
        set({ deals, ratings, isDemo: false })
      },

      setRating: (name, rating, note = '') =>
        set((s) => ({
          ratings: { ...s.ratings, [name]: { rating, note } },
        })),

      counterparties: () => {
        const names = new Set(get().deals.map((d) => (d.counterparty || '').trim()).filter(Boolean))
        return [...names].sort((a, b) => a.localeCompare(b, 'ru'))
      },
    }),
    {
      name: 'spreadbook-storage-v1',
      partialize: (s) => ({ deals: s.deals, ratings: s.ratings, isDemo: s.isDemo, period: s.period }),
    },
  ),
)
