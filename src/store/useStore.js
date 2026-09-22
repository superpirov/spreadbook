import { create } from 'zustand'
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '../utils/firebase.js'

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const enc = (name) => encodeURIComponent(name)

// Firestore layout (per Firebase user):
//   users/{uid}                 -> { knownCounterparties[], period, ...profile/sub fields }
//   users/{uid}/deals/{dealId}  -> deal object (doc id == deal.id)
//   users/{uid}/contacts/{enc}  -> { name, rating, note, wallets, cardNumber, phone, bank }
// localStorage keeps a per-user instant cache + offline fallback.
// Writes are optimistic-local first, then Firestore (snapshot echoes confirm).

const dealsCol = (owner) => collection(db, 'users', owner, 'deals')
const dealDoc = (owner, id) => doc(db, 'users', owner, 'deals', id)
const contactsCol = (owner) => collection(db, 'users', owner, 'contacts')
const contactDoc = (owner, name) => doc(db, 'users', owner, 'contacts', enc(name))
const userDoc = (owner) => doc(db, 'users', owner)
const amlCol = (owner) => collection(db, 'users', owner, 'amlchecks')

const cacheKey = (owner) => `spreadbook-cache-v1-${owner}`

function loadCache(owner) {
  try {
    const raw = localStorage.getItem(cacheKey(owner))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || typeof d !== 'object') return null
    return {
      deals: Array.isArray(d.deals) ? d.deals : [],
      ratings: d.ratings && typeof d.ratings === 'object' ? d.ratings : {},
      profiles: d.profiles && typeof d.profiles === 'object' ? d.profiles : {},
      knownCounterparties: Array.isArray(d.knownCounterparties) ? d.knownCounterparties : [],
      period: d.period || 'all',
      amlHistory: Array.isArray(d.amlHistory) ? d.amlHistory : [],
      aml: d.aml && typeof d.aml === 'object' ? d.aml : {},
    }
  } catch {
    return null
  }
}

function readLegacyLocal() {
  // Pre-cloud database (spreadbook-storage-v2), migrated once to the cloud.
  try {
    const raw = localStorage.getItem('spreadbook-storage-v2')
    const d = JSON.parse(raw)?.state
    if (!d) return null
    return {
      deals: Array.isArray(d.deals) ? d.deals : [],
      ratings: d.ratings && typeof d.ratings === 'object' ? d.ratings : {},
      profiles: d.profiles && typeof d.profiles === 'object' ? d.profiles : {},
      knownCounterparties: Array.isArray(d.knownCounterparties) ? d.knownCounterparties : [],
    }
  } catch {
    return null
  }
}

let boundUid = null
let unsubs = []
let migratedThisSession = false

export const useStore = create((set, get) => ({
  deals: [],
  isDemo: false,
  ratings: {},
  profiles: {},
  knownCounterparties: [],
  period: 'all',
  theme: 'dark',
  amlHistory: [], // [{ id, address, network, verdict, matches, frozen, counterparty, createdAt }]
  aml: {}, // { [contactName]: { status: 'clean'|'bad', at } }
  cloudReady: false, // first snapshot received
  cloudError: null,

  owner: () => boundUid,

  saveCache: () => {
    if (!boundUid) return
    const s = get()
    try {
      localStorage.setItem(
        cacheKey(boundUid),
        JSON.stringify({
          deals: s.deals,
          ratings: s.ratings,
          profiles: s.profiles,
          knownCounterparties: s.knownCounterparties,
          period: s.period,
          amlHistory: s.amlHistory.slice(0, 100),
          aml: s.aml,
        }),
      )
    } catch {
      /* storage full/blocked — cloud remains source of truth */
    }
  },

  // Attach realtime listeners for a Firebase user. Idempotent per uid.
  bindUser: (owner) => {
    if (!owner || boundUid === owner) return
    get().unbindUser()
    boundUid = owner
    migratedThisSession = false

    const cached = loadCache(owner)
    set({
      deals: cached?.deals || [],
      ratings: cached?.ratings || {},
      profiles: cached?.profiles || {},
      knownCounterparties: cached?.knownCounterparties || [],
      period: cached?.period || 'all',
      amlHistory: cached?.amlHistory || [],
      aml: cached?.aml || {},
      cloudReady: false,
      cloudError: null,
    })

    const onErr = (label) => (e) => {
      console.warn(`[spreadbook] ${label} snapshot failed`, e?.code || e)
      set({ cloudError: 'Нет связи с облаком — показаны локальные данные.' })
    }

    const un1 = onSnapshot(
      dealsCol(owner),
      (snap) => {
        const deals = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
        set({ deals, cloudReady: true, cloudError: null })
        get().saveCache()
        get().maybeMigrate()
      },
      onErr('deals'),
    )

    const un2 = onSnapshot(
      contactsCol(owner),
      (snap) => {
        const ratings = {}
        const profiles = {}
        const aml = {}
        for (const d of snap.docs) {
          const c = d.data()
          if (!c?.name) continue
          if (c.rating || c.note) ratings[c.name] = { rating: c.rating || 0, note: c.note || '' }
          const { wallets, cardNumber, phone, bank } = c
          if (wallets || cardNumber || phone || bank) profiles[c.name] = { wallets, cardNumber, phone, bank }
          if (c.amlStatus) aml[c.name] = { status: c.amlStatus, at: c.amlCheckedAt || null }
        }
        set({ ratings, profiles, aml, cloudError: null })
        get().saveCache()
        get().maybeMigrate()
      },
      onErr('contacts'),
    )

    const un3 = onSnapshot(
      userDoc(owner),
      (snap) => {
        const d = snap.data()
        if (!d) return
        set({
          knownCounterparties: Array.isArray(d.knownCounterparties) ? d.knownCounterparties : get().knownCounterparties,
          period: d.period || get().period,
        })
        get().saveCache()
      },
      onErr('user'),
    )

    const un4 = onSnapshot(
      query(amlCol(owner), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => {
        set({ amlHistory: snap.docs.map((d) => ({ id: d.id, ...d.data() })), cloudError: null })
        get().saveCache()
      },
      onErr('aml'),
    )

    unsubs = [un1, un2, un3, un4]
  },

  unbindUser: () => {
    unsubs.forEach((u) => {
      try {
        u()
      } catch {
        /* noop */
      }
    })
    unsubs = []
    boundUid = null
    set({ deals: [], ratings: {}, profiles: {}, knownCounterparties: [], period: 'all', amlHistory: [], aml: {}, cloudReady: false, cloudError: null })
  },

  // One-time upload of the pre-cloud local database (only if cloud is empty).
  maybeMigrate: async () => {
    if (migratedThisSession || !boundUid) return
    const s = get()
    if (s.deals.length > 0 || Object.keys(s.ratings).length > 0) {
      migratedThisSession = true
      return // cloud already has data — nothing to do
    }
    const legacy = readLegacyLocal()
    if (!legacy || (legacy.deals.length === 0 && Object.keys(legacy.ratings).length === 0 && legacy.knownCounterparties.length === 0)) {
      migratedThisSession = true
      return
    }
    migratedThisSession = true
    try {
      const batch = writeBatch(db)
      for (const d of legacy.deals) {
        const id = d.id || uid()
        batch.set(dealDoc(boundUid, id), { ...d, id })
      }
      const names = new Set([...Object.keys(legacy.ratings), ...Object.keys(legacy.profiles)])
      for (const name of names) {
        batch.set(
          contactDoc(boundUid, name),
          {
            name,
            rating: legacy.ratings[name]?.rating || 0,
            note: legacy.ratings[name]?.note || '',
            wallets: legacy.profiles[name]?.wallets || '',
            cardNumber: legacy.profiles[name]?.cardNumber || '',
            phone: legacy.profiles[name]?.phone || '',
            bank: legacy.profiles[name]?.bank || '',
          },
          { merge: true },
        )
      }
      if (legacy.knownCounterparties.length > 0) {
        batch.set(userDoc(boundUid), { knownCounterparties: legacy.knownCounterparties }, { merge: true })
      }
      await batch.commit()
      // Snapshots will pick the data up; local state updates via listeners.
    } catch (e) {
      console.warn('[spreadbook] migration failed', e?.code || e)
    }
  },

  persistUserFields: async () => {
    if (!boundUid) return
    try {
      await setDoc(
        userDoc(boundUid),
        { knownCounterparties: get().knownCounterparties, period: get().period },
        { merge: true },
      )
    } catch {
      /* offline — snapshot/cache keeps local state */
    }
  },

  setPeriod: (period) => {
    set({ period })
    get().saveCache()
    get().persistUserFields()
  },

  addDeal: async (deal) => {
    const entry = { ...deal, id: deal.id || uid() }
    set((s) => ({ deals: [entry, ...s.deals] }))
    get().saveCache()
    if (!boundUid) return
    try {
      await setDoc(dealDoc(boundUid, entry.id), entry)
    } catch {
      /* offline — will sync from cache next time */
    }
  },

  updateDeal: async (id, patch) => {
    set((s) => ({ deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
    get().saveCache()
    if (!boundUid) return
    try {
      await setDoc(dealDoc(boundUid, id), patch, { merge: true })
    } catch {
      /* offline */
    }
  },

  deleteDeal: async (id) => {
    set((s) => ({ deals: s.deals.filter((d) => d.id !== id) }))
    get().saveCache()
    if (!boundUid) return
    try {
      await deleteDoc(dealDoc(boundUid, id))
    } catch {
      /* offline */
    }
  },

  clearDemo: () => set({ deals: [], isDemo: false }),

  resetAll: async () => {
    const s = get()
    set({ deals: [], ratings: {}, profiles: {}, knownCounterparties: [], amlHistory: [], aml: {}, isDemo: false })
    get().saveCache()
    if (!boundUid) return
    try {
      const batch = writeBatch(db)
      for (const d of s.deals) batch.delete(dealDoc(boundUid, d.id))
      for (const name of new Set([...Object.keys(s.ratings), ...Object.keys(s.profiles)])) {
        batch.delete(contactDoc(boundUid, name))
      }
      for (const h of s.amlHistory) {
        if (h.id) batch.delete(doc(db, 'users', boundUid, 'amlchecks', h.id))
      }
      batch.set(userDoc(boundUid), { knownCounterparties: [] }, { merge: true })
      await batch.commit()
    } catch {
      /* offline */
    }
  },

  // Import replaces the whole DB (with user confirmation in UI).
  importData: async (payload) => {
    const deals = (Array.isArray(payload?.deals) ? payload.deals : []).map((d) => ({ ...d, id: d.id || uid() }))
    const ratings = payload?.ratings && typeof payload.ratings === 'object' ? payload.ratings : {}
    const profiles = payload?.profiles && typeof payload.profiles === 'object' ? payload.profiles : {}
    const known = Array.isArray(payload?.knownCounterparties) ? payload.knownCounterparties : []
    set({ deals, ratings, profiles, knownCounterparties: known, isDemo: false })
    get().saveCache()
    if (!boundUid) return
    try {
      const batch = writeBatch(db)
      for (const d of deals) batch.set(dealDoc(boundUid, d.id), d)
      const names = new Set([...Object.keys(ratings), ...Object.keys(profiles)])
      for (const name of names) {
        batch.set(
          contactDoc(boundUid, name),
          {
            name,
            rating: ratings[name]?.rating || 0,
            note: ratings[name]?.note || '',
            wallets: profiles[name]?.wallets || '',
            cardNumber: profiles[name]?.cardNumber || '',
            phone: profiles[name]?.phone || '',
            bank: profiles[name]?.bank || '',
          },
          { merge: true },
        )
      }
      batch.set(userDoc(boundUid), { knownCounterparties: known }, { merge: true })
      await batch.commit()
    } catch {
      /* offline */
    }
  },

  setRating: async (name, rating, note = '') => {
    set((s) => ({ ratings: { ...s.ratings, [name]: { rating, note } } }))
    get().saveCache()
    if (!boundUid) return
    try {
      await setDoc(contactDoc(boundUid, name), { name, rating, note }, { merge: true })
    } catch {
      /* offline */
    }
  },
  setProfile: async (name, patch) => {
    set((s) => ({
      profiles: { ...s.profiles, [name]: { wallets: '', cardNumber: '', phone: '', bank: '', ...(s.profiles[name] || {}), ...patch } },
    }))
    get().saveCache()
    if (!boundUid) return
    try {
      await setDoc(contactDoc(boundUid, name), { name, ...patch }, { merge: true })
    } catch {
      /* offline */
    }
  },

  // --- AML ---

  setAmlStatus: async (name, status) => {
    const at = new Date().toISOString()
    set((s) => ({ aml: { ...s.aml, [name]: { status, at } } }))
    get().saveCache()
    if (!boundUid) return
    try {
      await setDoc(contactDoc(boundUid, name), { name, amlStatus: status, amlCheckedAt: at }, { merge: true })
    } catch {
      /* offline */
    }
  },

  logAmlCheck: async (entry) => {
    // entry: { address, network, verdict, matches, frozen, counterparty }
    const rec = { ...entry, id: entry.id || uid(), createdAt: new Date().toISOString() }
    set((s) => ({ amlHistory: [rec, ...s.amlHistory].slice(0, 100) }))
    get().saveCache()
    if (!boundUid) return rec.id
    try {
      const { id, ...payload } = rec
      void id
      await addDoc(amlCol(boundUid), payload)
    } catch {
      /* offline — cached locally */
    }
    return rec.id
  },

  clearAmlHistory: async () => {
    const ids = get().amlHistory.map((h) => h.id).filter(Boolean)
    set({ amlHistory: [] })
    get().saveCache()
    if (!boundUid || ids.length === 0) return
    try {
      const batch = writeBatch(db)
      for (const id of ids) batch.delete(doc(db, 'users', boundUid, 'amlchecks', id))
      await batch.commit()
    } catch {
      /* offline */
    }
  },

  // Explicitly added counterparties (without deals yet).
  addCounterparty: (name) => {
    const clean = String(name || '').trim()
    if (!clean) return false
    const exists = get()
      .counterparties()
      .some((c) => c.toLowerCase() === clean.toLowerCase())
    if (exists) return false
    set((s) => ({ knownCounterparties: [...s.knownCounterparties, clean] }))
    get().saveCache()
    get().persistUserFields()
    return true
  },

  removeCounterparty: (name) => {
    set((s) => ({ knownCounterparties: s.knownCounterparties.filter((c) => c !== name) }))
    get().saveCache()
    get().persistUserFields()
  },

  // Full delete: removes from known list, drops rating/profile, and
  // unlinks the name from existing deals (deals themselves are kept).
  deleteCounterparty: async (name) => {
    const s = get()
    const ratings = { ...s.ratings }
    delete ratings[name]
    const profiles = { ...s.profiles }
    delete profiles[name]
    set({
      knownCounterparties: s.knownCounterparties.filter((c) => c !== name),
      ratings,
      profiles,
      deals: s.deals.map((d) => (d.counterparty === name ? { ...d, counterparty: '' } : d)),
    })
    get().saveCache()
    if (!boundUid) return
    try {
      const batch = writeBatch(db)
      batch.delete(contactDoc(boundUid, name))
      for (const d of s.deals) {
        if (d.counterparty === name) batch.set(dealDoc(boundUid, d.id), { counterparty: '' }, { merge: true })
      }
      batch.set(userDoc(boundUid), { knownCounterparties: get().knownCounterparties }, { merge: true })
      await batch.commit()
    } catch {
      /* offline */
    }
  },

  counterparties: () => {
    const fromDeals = get().deals.map((d) => (d.counterparty || '').trim()).filter(Boolean)
    const names = new Set([...fromDeals, ...get().knownCounterparties])
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'))
  },
}))
