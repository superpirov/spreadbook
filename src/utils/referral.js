// Referral program (no backend).
// - Code: SB-XXXXXX derived from uid (unique by construction).
// - Link: <site>/?ref=CODE#/login — captured before auth, consumed on register.
// - Reward: referrer claims +7 days PRO for every referral that paid.
//   Claiming writes referrer's OWN user doc (allowed), so no server needed.
// - Referee gets the standard trial (double-sided bonuses — later).

export const REF_BONUS_DAYS = 7
export const REF_CASH_PCT = 0.25 // 25% of the paid plan price, manual payout by owner
const PENDING_KEY = 'spreadbook-ref'

export function makeRefCode(uid) {
  const tail = String(uid || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X')
  return `SB-${tail}`
}

// Invite link works with HashRouter: query sits BEFORE the hash.
export function refLink(code) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}?ref=${encodeURIComponent(code)}#/login`
}

// Call once on app start (main.jsx). Persists the code until registration.
export function captureRefParam() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code && /^[A-Za-z0-9-]{3,20}$/.test(code.trim())) {
      localStorage.setItem(PENDING_KEY, code.trim().toUpperCase())
    }
  } catch {
    /* ignore */
  }
}

export function consumeRefParam() {
  try {
    const code = localStorage.getItem(PENDING_KEY)
    localStorage.removeItem(PENDING_KEY)
    return code || null
  } catch {
    return null
  }
}

// Peek without removing (for banners/diagnostics).
export function peekRefParam() {
  try {
    return localStorage.getItem(PENDING_KEY) || null
  } catch {
    return null
  }
}
