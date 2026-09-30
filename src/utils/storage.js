// Safe localStorage wrapper.
// Problem it solves: heavy users fill the ~5MB localStorage quota
// (deal snapshots, AML history with full KYT reports, screening lists),
// after which EVERYTHING breaks at once — including Firebase persistence
// ("QuotaExceededError ... setItem", INTERNAL ASSERTION FAILED).
// Strategy: on quota pressure purge our bulky caches (never auth/identity
// keys), retry once, and fall back to memory so the app keeps working.

const PURGEABLE = [/^spreadbook-cache-v1-/, /^spreadbook-aml-v1$/, /^spreadbook-community-v1$/]
const memFallback = new Map()

function purge() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && PURGEABLE.some((re) => re.test(k))) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}

export function safeGet(key) {
  try {
    const v = localStorage.getItem(key)
    if (v !== null) return v
    return memFallback.has(key) ? memFallback.get(key) : null
  } catch {
    return memFallback.has(key) ? memFallback.get(key) : null
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
    memFallback.delete(key)
    return true
  } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || String(e?.message || '').includes('QuotaExceeded'))
    if (quota) {
      purge()
      try {
        localStorage.setItem(key, value)
        memFallback.delete(key)
        return true
      } catch {
        /* fall through to memory */
      }
    }
    memFallback.set(key, value)
    return false
  }
}

export function safeRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  memFallback.delete(key)
}

// Nuclear option for a corrupted local Firestore persistence (e.g. after a
// quota crash every query hangs with no error code). Clears our caches and
// Firestore's IndexedDB, keeps Firebase Auth session, then reloads.
export async function resetLocalCaches() {
  try {
    const doomed = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('spreadbook-')) doomed.push(k)
    }
    doomed.forEach((k) => {
      try {
        localStorage.removeItem(k)
      } catch {
        /* ignore */
      }
    })
  } catch {
    /* ignore */
  }
  memFallback.clear()
  try {
    const dbs = (await indexedDB.databases?.()) || []
    await Promise.all(
      dbs
        .map((d) => d.name)
        .filter((n) => n && /firestore|firebase/i.test(n))
        .map((n) => new Promise((res) => {
          const req = indexedDB.deleteDatabase(n)
          req.onsuccess = req.onerror = req.onblocked = () => res()
        })),
    )
  } catch {
    /* ignore */
  }
  window.location.reload()
}
