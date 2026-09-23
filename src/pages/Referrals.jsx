import { useCallback, useEffect, useState } from 'react'
import { Users, Copy, Check, Gift, Loader2, Banknote } from 'lucide-react'
import { useAuth, useCurrentSub } from '../store/useAuth.js'
import { ensureRefCode, fetchMyReferrals, claimReferralBonus, claimReferralCash } from '../utils/users.js'
import { REF_BONUS_DAYS, REF_CASH_PCT, refLink } from '../utils/referral.js'
import { formatDate } from '../utils/formatters.js'

const cashOf = (r) => Math.round((Number(r.price) || 0) * REF_CASH_PCT * 100) / 100

export default function Referrals() {
  const user = useAuth((s) => s.user)
  const sub = useCurrentSub()
  const [code, setCode] = useState('')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [claiming, setClaiming] = useState(null)
  const [msg, setMsg] = useState('')
  const [cashFor, setCashFor] = useState(null) // referral id with open wallet form
  const [wallet, setWallet] = useState(() => {
    try {
      return localStorage.getItem('spreadbook-payout-wallet') || ''
    } catch {
      return ''
    }
  })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [c, rows] = await Promise.all([ensureRefCode(user.id), fetchMyReferrals(user.id)])
      setCode(c)
      setList(rows)
    } catch {
      setError('Не удалось загрузить реферальные данные. Проверьте интернет и rules Firestore (refcodes/referrals).')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(refLink(code))
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const claim = async (r) => {
    setClaiming(r.id)
    setMsg('')
    try {
      const next = await claimReferralBonus(user.id, r.id, sub?.expiresAt || null, REF_BONUS_DAYS)
      setList((rows) => rows.map((x) => (x.id === r.id ? { ...x, bonusType: 'days', claimed: true, claimedAt: new Date().toISOString() } : x)))
      setMsg(`+${REF_BONUS_DAYS} дней PRO начислено (до ${formatDate(next)}). Подписка обновится сразу.`)
    } catch (e) {
      setMsg(e.message || 'Не удалось забрать бонус.')
    } finally {
      setClaiming(null)
    }
  }

  const claimCash = async (r) => {
    if (!wallet.trim()) {
      setMsg('Укажите кошелёк USDT (TRC-20) для выплаты.')
      return
    }
    setClaiming(r.id)
    setMsg('')
    try {
      const amount = await claimReferralCash(user.id, r.id, wallet.trim(), REF_CASH_PCT)
      try {
        localStorage.setItem('spreadbook-payout-wallet', wallet.trim())
      } catch {
        /* ignore */
      }
      setList((rows) => rows.map((x) => (x.id === r.id ? { ...x, bonusType: 'cash', cashAmount: amount, cashStatus: 'pending', payoutWallet: wallet.trim(), claimedAt: new Date().toISOString() } : x)))
      setCashFor(null)
      setMsg(`Заявка на выплату ${amount} USDT создана. Владелец переведёт деньги вручную и отметит выплату.`)
    } catch (e) {
      setMsg(e.message || 'Не удалось создать заявку.')
    } finally {
      setClaiming(null)
    }
  }

  const paid = list.filter((r) => r.status === 'paid')
  const pending = list.filter((r) => r.status !== 'paid')
  const unclaimed = paid.filter((r) => !r.claimed && !r.bonusType)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Реферальная программа</h1>
        <p className="text-sm text-slate-400">
          За каждого оплатившего друга — на ваш выбор: +{REF_BONUS_DAYS} дней PRO или {Math.round(REF_CASH_PCT * 100)}% от его подписки деньгами. Можно чередовать.
        </p>
      </div>

      <div className="card bg-gradient-to-br from-brand/15 via-ink-900 to-mint/10 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users size={15} /> Ваша пригласительная ссылка</h3>
        {loading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Готовим ссылку…</p>
        ) : code ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2.5">
            <code className="min-w-0 flex-1 break-all text-xs text-emerald-200">{refLink(code)}</code>
            <button onClick={copy} className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs">
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              {copied ? 'Ок' : 'Копия'}
            </button>
          </div>
        ) : null}
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['Пришло', list.length], ['Оплатили', paid.length], ['К выдаче', unclaimed.length]].map(([t, v]) => (
            <div key={t} className="rounded-xl bg-white/[0.04] px-2 py-3">
              <div className="text-lg font-extrabold">{loading ? '…' : v}</div>
              <div className="text-[11px] text-slate-400">{t}</div>
            </div>
          ))}
        </div>
      </div>

      {msg && <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">{msg}</p>}

      <div className="card overflow-hidden">
        <h3 className="border-b border-white/10 px-4 py-3 text-sm font-bold">Приглашённые ({list.length})</h3>
        {list.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Пока никого. Отправьте ссылку другу — когда он зарегистрируется, он появится здесь, а после его оплаты сможете забрать бонус.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {list.map((r) => (
              <div key={r.id} className="px-4 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.refereeEmail || '—'}</div>
                    <div className="text-xs text-slate-500">рег. {r.createdAt ? formatDate(r.createdAt) : '—'}</div>
                  </div>
                  {r.status === 'paid' ? (
                    <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">Оплатил</span>
                  ) : (
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-bold text-slate-400">Регистрация</span>
                  )}
                  {r.status === 'paid' && !r.bonusType && (
                    <>
                      <button
                        disabled={claiming === r.id}
                        onClick={() => claim(r)}
                        title={`Забрать +${REF_BONUS_DAYS} дней PRO`}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        <Gift size={13} /> {claiming === r.id ? '…' : `+${REF_BONUS_DAYS} дней`}
                      </button>
                      {cashOf(r) > 0 ? (
                        <button
                          onClick={() => setCashFor(cashFor === r.id ? null : r.id)}
                          title={`Забрать ${cashOf(r)} USDT деньгами`}
                          className="btn-ghost px-3 py-1.5 text-xs"
                        >
                          <Banknote size={13} /> {cashOf(r)} USDT
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500" title="Сумма оплаты неизвестна (оплата до обновления)">дни доступны</span>
                      )}
                    </>
                  )}
                  {r.bonusType === 'days' && <span className="text-xs text-emerald-300">+{REF_BONUS_DAYS} дней ✓</span>}
                  {r.bonusType === 'cash' && (
                    <span className="text-xs text-amber-200">
                      {r.cashAmount} USDT · {r.cashStatus === 'paid' ? 'выплачено ✓' : 'ждет выплаты'}
                    </span>
                  )}
                </div>
                {cashFor === r.id && r.status === 'paid' && !r.bonusType && (
                  <div className="mt-2 flex flex-col gap-2 rounded-xl bg-white/[0.03] p-3 sm:flex-row">
                    <input
                      className="input font-mono text-xs"
                      placeholder="Ваш USDT-кошелёк (TRC-20) для выплаты"
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                    />
                    <button
                      disabled={claiming === r.id}
                      onClick={() => claimCash(r)}
                      className="btn-mint shrink-0 px-3 py-2 text-xs"
                    >
                      {claiming === r.id ? '…' : `Получить ${cashOf(r)} USDT`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {pending.length > 0 && (
          <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
            Бонус начисляется, когда приглашённый оплатит подписку (статус станет «Оплатил»).
          </p>
        )}
      </div>
    </div>
  )
}
