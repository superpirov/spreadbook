// Connection diagnostics: finds the REAL cause when Firestore reads hang.
// Distinguishes four cases that look identical in UI ("timeout, no code"):
//  1. origin storage pressure (quota) — storage.estimate + localStorage probe,
//  2. unpublished/wrong rules — REST probes return permission-denied fast,
//  3. broken local SDK persistence — REST works, SDK hangs,
//  4. network block (VPN/adblock/antivirus/ISP) — even plain HTTPS hangs.
import { collection, doc, getDocs, limit, query, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'

const PROJECT = 'spreadbook-5452d'
const REST = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

function fmtBytes(n) {
  if (!n && n !== 0) return '—'
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} МБ`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} ГБ`
}

async function timed(fn, ms) {
  const started = performance.now()
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout: превышено ожидание ответа')), ms)
  })
  try {
    const value = await Promise.race([fn(), timeout])
    return { value, ms: Math.round(performance.now() - started) }
  } catch (e) {
    e._ms = Math.round(performance.now() - started)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const short = (e) => String(e?.message || e || 'ошибка').slice(0, 140)

export async function runConnDiag() {
  const out = []

  // 1. Origin storage pressure (localStorage + IndexedDB share one quota).
  try {
    const est = await navigator.storage?.estimate?.()
    if (est && est.quota) {
      const pct = Math.round(((est.usage || 0) / est.quota) * 100)
      out.push({
        name: 'Хранилище браузера',
        ok: pct < 85,
        ms: 0,
        detail: `занято ${fmtBytes(est.usage)} из ${fmtBytes(est.quota)} (${pct}%)${pct >= 85 ? ' — ПЕРЕПОЛНЕНО, очистите кэш' : ''}`,
      })
    } else {
      out.push({ name: 'Хранилище браузера', ok: true, ms: 0, detail: 'estimate недоступен' })
    }
  } catch (e) {
    out.push({ name: 'Хранилище браузера', ok: false, ms: 0, detail: short(e) })
  }

  // 2. localStorage read/write probe.
  try {
    const k = 'spreadbook-probe'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    out.push({ name: 'localStorage', ok: true, ms: 0, detail: 'запись/чтение работают' })
  } catch (e) {
    out.push({ name: 'localStorage', ok: false, ms: 0, detail: `${e?.name || 'ошибка'}: хранилище недоступно или переполнено` })
  }

  // Auth token for the REST probes.
  let token = null
  try {
    token = await auth.currentUser?.getIdToken()
  } catch (e) {
    out.push({ name: 'Токен авторизации', ok: false, ms: 0, detail: short(e) })
  }
  if (!token) {
    out.push({ name: 'REST и SDK пробы', ok: false, ms: 0, detail: 'пропущены: нет токена (перелогиньтесь)' })
    return out
  }

  // 3. Plain HTTPS read (bypasses the SDK entirely).
  try {
    const { value: res, ms } = await timed(
      () => fetch(`${REST}/users?pageSize=1`, { headers: { Authorization: `Bearer ${token}` } }),
      10000,
    )
    if (res.ok) {
      out.push({ name: 'REST-чтение users', ok: true, ms, detail: `HTTP ${res.status}: сеть до Firestore в порядке` })
    } else {
      const body = await res.text().catch(() => '')
      const denied = res.status === 403 || /permission.?denied/i.test(body)
      out.push({
        name: 'REST-чтение users',
        ok: false,
        ms,
        detail: denied
          ? `HTTP 403 permission-denied: RULES не опубликованы или запрещают чтение. Нажмите Publish в Firestore Rules.`
          : `HTTP ${res.status}: ${body.slice(0, 120)}`,
      })
    }
  } catch (e) {
    out.push({ name: 'REST-чтение users', ok: false, ms: e._ms || 0, detail: `${short(e)} — сеть до firestore.googleapis.com не отвечает (VPN/блокировщик/провайдер)` })
  }

  // 4. Plain HTTPS write into visits (reveals unpublished visits rules).
  const uid = auth.currentUser?.uid || 'nouser'
  const probeId = `2099-01-01_probe-${uid.slice(0, 8)}`
  try {
    const { value: res, ms } = await timed(
      () => fetch(`${REST}/visits?documentId=${probeId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            date: { stringValue: '2099-01-01' },
            visitorId: { stringValue: 'probe' },
            email: { nullValue: null },
            lastSeen: { stringValue: new Date().toISOString() },
          },
        }),
      }),
      10000,
    )
    if (res.ok || res.status === 409) {
      out.push({ name: 'REST-запись visits', ok: true, ms, detail: res.ok ? 'rules для visits разрешают запись' : 'пробный документ уже существует — запись разрешена' })
    } else {
      const body = await res.text().catch(() => '')
      const denied = res.status === 403 || /permission.?denied/i.test(body)
      out.push({
        name: 'REST-запись visits',
        ok: false,
        ms,
        detail: denied
          ? 'HTTP 403 permission-denied: rules для visits НЕ опубликованы — счётчик не пишет. Вставьте rules из README и нажмите Publish.'
          : `HTTP ${res.status}: ${body.slice(0, 120)}`,
      })
    }
  } catch (e) {
    out.push({ name: 'REST-запись visits', ok: false, ms: e._ms || 0, detail: short(e) })
  }

  // 5. Same read through the Firebase SDK (uses local persistence layer).
  try {
    const { value: snap, ms } = await timed(() => getDocs(query(collection(db, 'users'), limit(1))), 10000)
    out.push({ name: 'SDK-чтение users', ok: true, ms, detail: `получено документов: ${snap.size} — SDK и кэш в порядке` })
  } catch (e) {
    out.push({ name: 'SDK-чтение users', ok: false, ms: e._ms || 0, detail: `${e?.code || ''} ${short(e)}` })
  }

  // 6. SDK write probe (same path the visitor tracker uses).
  try {
    const { ms } = await timed(
      () => setDoc(doc(db, 'visits', probeId), {
        date: '2099-01-01',
        visitorId: 'probe',
        email: null,
        lastSeen: new Date().toISOString(),
      }),
      10000,
    )
    out.push({ name: 'SDK-запись visits', ok: true, ms, detail: 'трекер посещений может писать' })
  } catch (e) {
    out.push({ name: 'SDK-запись visits', ok: false, ms: e._ms || 0, detail: `${e?.code || ''} ${short(e)}` })
  }

  return out
}

export function summarizeConnDiag(results) {
  const by = (n) => results.find((r) => r.name === n)
  const rest = by('REST-чтение users')
  const sdk = by('SDK-чтение users')
  const visits = by('REST-запись visits')
  const storage = by('Хранилище браузера')
  if (storage && !storage.ok) return 'Переполнено хранилище браузера. Нажмите «Очистить локальный кэш и перезагрузить» ниже.'
  if (rest && !rest.ok && /permission-denied|403/.test(rest.detail)) {
    return 'Firestore Rules не опубликованы или запрещают чтение. Вставьте rules из README.md и нажмите Publish, затем обновите страницу.'
  }
  if (visits && !visits.ok && /permission-denied|403/.test(visits.detail)) {
    return 'Rules для visits не опубликованы — счётчик посещений не пишет и статистика пуста. Опубликуйте rules из README.'
  }
  if (rest?.ok && sdk && !sdk.ok) {
    return 'Прямой HTTPS работает, а SDK виснет — побит локальный кэш Firestore. Нажмите «Очистить локальный кэш и перезагрузить».'
  }
  if (rest && !rest.ok) {
    return 'Даже прямой HTTPS до Firestore не отвечает — сеть режет firestore.googleapis.com (VPN, блокировщик рекламы, антивирус, провайдер). Попробуйте другой интернет (мобильный) и отключите блокировщики.'
  }
  if (results.every((r) => r.ok)) return 'Все пробы прошли — соединение в порядке. Обновите страницу: ошибки были временными.'
  return 'Часть проб не прошла — смотрите детали выше.'
}
