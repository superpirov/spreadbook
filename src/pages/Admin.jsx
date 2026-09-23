import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Minus, Plus, ExternalLink, RefreshCw, Flag, Check, X, Trash2, Search, Banknote } from 'lucide-react'
import { useAuth } from '../store/useAuth.js'
import { isAdmin } from '../utils/admin.js'
import { fetchAllUsers, adjustMonths, fetchReports, moderateReport, deleteReport, fetchCashPayouts, markPayoutPaid } from '../utils/users.js'
import { getAccessState, tronscanUrl } from '../utils/billing.js'
import { formatDate, formatDateTime } from '../utils/formatters.js'

const accessOf = (u) => getAccessState({ plan: u.plan, trialStart: u.trialStart, expiresAt: u.expiresAt })

export default function Admin() {
  const user = useAuth((s) => s.user)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyUid, setBusyUid] = useState(null)
  const [reports, setReports] = useState([])
  const [reportsError, setReportsError] = useState('')
  const [query, setQuery] = useState('')
  const [payouts, setPayouts] = useState([])
  const [payoutsError, setPayoutsError] = useState('')

  const loadPayouts = useCallback(async () => {
    try {
      setPayouts(await fetchCashPayouts())
      setPayoutsError('')
    } catch {
      setPayoutsError('Выплаты не загрузились — проверьте rules для коллекции referrals.')
    }
  }, [])

  const loadReports = useCallback(async () => {
    try {
      setReports(await fetchReports('pending'))
      setReportsError('')
    } catch {
      setReportsError('Жалобы не загрузились — проверьте rules для коллекции reports.')
    }
  }, [])

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
    if (isAdmin(user)) {
      load()
      loadReports()
      loadPayouts()
    } else setLoading(false)
  }, [user, load, loadReports, loadPayouts])

  const payOut = async (id) => {
    if (!window.confirm('Отметить выплату как совершённую? Деньги уже должны быть отправлены на кошелёк.')) return
    try {
      await markPayoutPaid(id)
      setPayouts((rows) => rows.map((p) => (p.id === id ? { ...p, cashStatus: 'paid', paidOutAt: new Date().toISOString() } : p)))
    } catch {
      setPayoutsError('Не удалось отметить выплату.')
    }
  }

  const moderate = async (id, status) => {
    try {
      await moderateReport(id, status)
      setReports((list) => list.filter((r) => r.id !== id))
    } catch {
      setReportsError('Не удалось обновить жалобу.')
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Удалить жалобу?')) return
    try {
      await deleteReport(id)
      setReports((list) => list.filter((r) => r.id !== id))
    } catch {
      setReportsError('Не удалось удалить жалобу.')
    }
  }

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

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? users.filter((u) => `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(needle))
    : users

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
        <div className="border-b border-white/10 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени или почте…"
              className="input pl-9"
            />
          </div>
          {needle && (
            <p className="px-1 pt-1.5 text-xs text-slate-500">Найдено: {visible.length} из {users.length}</p>
          )}
        </div>
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
              {visible.map((u) => {
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
              {visible.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">{needle ? 'Никого не найдено.' : 'Пользователей пока нет.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="space-y-2 p-3 md:hidden">
          {visible.length === 0 && !loading && (
            <p className="py-6 text-center text-sm text-slate-500">{needle ? 'Никого не найдено.' : 'Пользователей пока нет.'}</p>
          )}
          {visible.map((u) => {
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

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Flag size={15} /> Жалобы на адреса ({reports.length})</h3>
          <button onClick={loadReports} className="btn-ghost px-3 py-1.5 text-xs">
            <RefreshCw size={13} /> Обновить
          </button>
        </div>
        {reportsError && <p className="px-4 py-2 text-xs text-red-300">{reportsError}</p>}
        {reports.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Новых жалоб нет. Одобренные метки расходятся всем пользователям при обновлении баз.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {reports.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-slate-200" title={r.address}>{r.address}</code>
                <span className="max-w-[220px] truncate text-xs text-slate-400" title={r.reason}>{r.reason || 'без причины'}</span>
                <span className="max-w-[160px] truncate text-[11px] text-slate-500">{r.reporter || ''} · {r.createdAt ? formatDate(r.createdAt) : ''}</span>
                <span className="flex gap-1.5">
                  <button onClick={() => moderate(r.id, 'approved')} title="Одобрить — метка разойдётся всем" className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-200 hover:bg-emerald-500/25"><Check size={14} /></button>
                  <button onClick={() => moderate(r.id, 'rejected')} title="Отклонить" className="rounded-lg bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"><X size={14} /></button>
                  <button onClick={() => remove(r.id)} title="Удалить" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-300"><Trash2 size={14} /></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Banknote size={15} /> Выплаты рефералам ({payouts.filter((p) => p.cashStatus !== 'paid').length} ждут)</h3>
          <button onClick={loadPayouts} className="btn-ghost px-3 py-1.5 text-xs">
            <RefreshCw size={13} /> Обновить
          </button>
        </div>
        {payoutsError && <p className="px-4 py-2 text-xs text-red-300">{payoutsError}</p>}
        {payouts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Заявок на денежные выплаты пока нет.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.refereeEmail || '—'} <span className="font-normal text-slate-500">→ реферер {p.code}</span></div>
                  <code className="block truncate font-mono text-xs text-emerald-200" title={p.payoutWallet}>{p.payoutWallet}</code>
                  <div className="text-[11px] text-slate-500">заявка {p.claimedAt ? formatDate(p.claimedAt) : '—'}</div>
                </div>
                <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">{p.cashAmount} USDT</span>
                {p.cashStatus === 'paid' ? (
                  <span className="text-xs text-emerald-300">Выплачено ✓</span>
                ) : (
                  <button onClick={() => payOut(p.id)} className="btn-mint px-3 py-1.5 text-xs">Выплачено</button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
          Переведите USDT вручную на указанный кошелёк и нажмите «Выплачено». 25% считаются от тарифа реферала.
        </p>
      </div>
    </div>
  )
}

function StatusPill({ st }) {
  if (st.status === 'pro') return <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">PRO · {st.daysLeft} дн.</span>
  if (st.status === 'trial') return <span className="rounded-md bg-mint/15 px-2 py-0.5 text-xs font-bold text-mint-soft">Триал · {st.daysLeft} дн.</span>
  return <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-300">Истёк</span>
}
