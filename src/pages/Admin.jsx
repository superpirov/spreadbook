import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Minus, Plus, ExternalLink, RefreshCw } from 'lucide-react'
import { useAuth } from '../store/useAuth.js'
import { isAdmin } from '../utils/admin.js'
import { fetchAllUsers, adjustMonths } from '../utils/users.js'
import { getAccessState, tronscanUrl } from '../utils/billing.js'
import { formatDate, formatDateTime } from '../utils/formatters.js'

const accessOf = (u) => getAccessState({ plan: u.plan, trialStart: u.trialStart, expiresAt: u.expiresAt })

export default function Admin() {
  const user = useAuth((s) => s.user)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyUid, setBusyUid] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await fetchAllUsers())
    } catch (e) {
      setError('Не удалось загрузить пользователей. Проверьте: 1) Firestore Database создан в консоли, 2) опубликованы rules из README (доступ только для admin email), 3) вы вошли под email администратора.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin(user)) load()
    else setLoading(false)
  }, [user, load])

  if (!isAdmin(user)) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <ShieldAlert size={28} className="mx-auto text-red-300" />
        <h1 className="mt-3 text-lg font-extrabold">Нет доступа</h1>
        <p className="mt-1 text-sm text-slate-400">Раздел только для администратора сервиса.</p>
        <Link to="/app" className="btn-ghost mt-4 w-full">В кабинет</Link>
      </div>
    )
  }

  const adjust = async (u, delta) => {
    setBusyUid(u.uid)
    try {
      const next = await adjustMonths(u.uid, u.expiresAt, delta)
      setUsers((list) => list.map((x) => (x.uid === u.uid ? { ...x, plan: 'pro', expiresAt: next } : x)))
    } catch {
      setError('Не удалось изменить подписку. Проверьте rules Firestore.')
    } finally {
      setBusyUid(null)
    }
  }

  const stats = {
    total: users.length,
    pro: users.filter((u) => accessOf(u).status === 'pro').length,
    trial: users.filter((u) => accessOf(u).status === 'trial').length,
    expired: users.filter((u) => accessOf(u).status === 'expired').length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Админка</h1>
          <p className="text-sm text-slate-400">Пользователи, оплаты и ручное управление подписками.</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Всего', stats.total],
          ['PRO', stats.pro],
          ['Триал', stats.trial],
          ['Истёк', stats.expired],
        ].map(([t, v]) => (
          <div key={t} className="card p-3 text-center">
            <div className="text-xl font-extrabold">{v}</div>
            <div className="text-xs text-slate-400">{t}</div>
          </div>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>}

      <div className="card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                {['Пользователь', 'Статус', 'Действует до', 'TXID', 'Управление'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const st = accessOf(u)
                return (
                  <tr key={u.uid} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{u.name || '—'}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                      <div className="text-[11px] text-slate-500">рег. {u.createdAt ? formatDate(u.createdAt) : '—'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill st={st} />
                      {st.status === 'trial' && <div className="mt-0.5 text-[11px] text-slate-500">триал с {u.trialStart ? formatDate(u.trialStart) : '—'}</div>}
                      {u.planId && <div className="mt-0.5 text-[11px] text-slate-500">тариф: {u.planId}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">{u.expiresAt ? formatDateTime(u.expiresAt) : '—'}</td>
                    <td className="max-w-[140px] truncate px-4 py-2.5 text-xs">
                      {u.txHash ? (
                        <a href={tronscanUrl(u.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-mint-soft hover:underline">
                          {u.txHash.slice(0, 10)}… <ExternalLink size={11} />
                        </a>
                      ) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <button disabled={busyUid === u.uid} onClick={() => adjust(u, -1)} title="Убрать 1 месяц" className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50">
                          <Minus size={13} /> 1 мес
                        </button>
                        <button disabled={busyUid === u.uid} onClick={() => adjust(u, 1)} title="Добавить 1 месяц бесплатно" className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">
                          <Plus size={13} /> 1 мес
                        </button>
                        <button disabled={busyUid === u.uid} onClick={() => adjust(u, 12)} title="Добавить 12 месяцев бесплатно" className="rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-400/25 disabled:opacity-50">
                          <Plus size={13} /> 12 мес
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Пользователей пока нет.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="space-y-2 p-3 md:hidden">
          {users.map((u) => {
            const st = accessOf(u)
            return (
              <div key={u.uid} className="rounded-xl border border-white/10 bg-ink-950/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{u.name || u.email}</div>
                    <div className="truncate text-xs text-slate-400">{u.email}</div>
                  </div>
                  <StatusPill st={st} />
                </div>
                <div className="mt-1 text-xs text-slate-400">До: {u.expiresAt ? formatDateTime(u.expiresAt) : '—'}</div>
                <div className="mt-2 flex gap-1.5">
                  <button disabled={busyUid === u.uid} onClick={() => adjust(u, -1)} className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-bold text-red-200 disabled:opacity-50">−1 мес</button>
                  <button disabled={busyUid === u.uid} onClick={() => adjust(u, 1)} className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-200 disabled:opacity-50">+1 мес</button>
                  <button disabled={busyUid === u.uid} onClick={() => adjust(u, 12)} className="rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 disabled:opacity-50">+12 мес</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Добавление месяцев продлевает PRO от max(сейчас, текущий срок). Убавление сдвигает срок назад. Изменения применяются у пользователя при следующем входе/обновлении (подписка подтягивается из облака).
      </p>
    </div>
  )
}

function StatusPill({ st }) {
  if (st.status === 'pro') return <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">PRO · {st.daysLeft} дн.</span>
  if (st.status === 'trial') return <span className="rounded-md bg-mint/15 px-2 py-0.5 text-xs font-bold text-mint-soft">Триал · {st.daysLeft} дн.</span>
  return <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-300">Истёк</span>
}
