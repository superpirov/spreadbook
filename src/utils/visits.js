import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase.js'

// Unique visitor stats (no backend).
// One doc per visitor per day: visits/{YYYY-MM-DD}_{visitorId}.
// Logged-in users are identified by uid (stable across devices),
// guests by a persistent anonymous id. Repeat visits same day just
// refresh lastSeen — the day counts once.

const ANON_KEY = 'spreadbook-anon-id'
const TRACK_KEY = 'spreadbook-tracked-day'

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getAnonId() {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) {
      id = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 10)}`
  }
}

// Call once per app start. Fire-and-forget; never blocks UI.
export async function trackVisit(user) {
  const today = dayKey()
  try {
    if (localStorage.getItem(TRACK_KEY) === `${today}:${user?.id || ''}`) return
  } catch {
    /* ignore */
  }
  const visitorId = user?.id || getAnonId()
  const id = `${today}_${visitorId}`
  try {
    // Full overwrite (no merge): repeat visits just refresh lastSeen.
    await setDoc(doc(db, 'visits', id), {
      date: today,
      visitorId,
      email: user?.email || null,
      lastSeen: new Date().toISOString(),
    })
    try {
      localStorage.setItem(TRACK_KEY, `${today}:${user?.id || ''}`)
    } catch {
      /* ignore */
    }
  } catch {
    /* stats must never break the app */
  }
}

// Admin: docs in [from, to] (YYYY-MM-DD). Returns { visits, uniques }.
export async function fetchVisitStats(from, to) {
  const snap = await getDocs(query(collection(db, 'visits'), where('date', '>=', from), where('date', '<=', to)))
  const docs = snap.docs.map((d) => d.data())
  return {
    visits: docs.length,
    uniques: new Set(docs.map((d) => d.visitorId)).size,
  }
}

// Admin: per-day visits for the last N days (for the bar chart).
export async function fetchDailyVisits(days = 14) {
  const now = new Date()
  const from = new Date(now)
  from.setDate(now.getDate() - (days - 1))
  const snap = await getDocs(
    query(collection(db, 'visits'), where('date', '>=', dayKey(from)), where('date', '<=', dayKey(now))),
  )
  const byDay = new Map()
  for (const d of snap.docs.map((x) => x.data())) {
    if (!byDay.has(d.date)) byDay.set(d.date, { visits: 0, users: new Set() })
    const e = byDay.get(d.date)
    e.visits += 1
    e.users.add(d.visitorId)
  }
  const out = []
  for (let i = 0; i < days; i++) {
    const dt = new Date(from)
    dt.setDate(from.getDate() + i)
    const key = dayKey(dt)
    const e = byDay.get(key)
    out.push({ date: key, label: `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}`, visits: e?.visits || 0, uniques: e ? e.users.size : 0 })
  }
  return out
}
