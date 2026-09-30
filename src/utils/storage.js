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
