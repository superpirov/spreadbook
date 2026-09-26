import { useState } from 'react'
import { Copy, Check, Crown, Clock, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth, useCurrentSub } from '../store/useAuth.js'
import { BILLING, PLANS, TX_MAX_AGE_DAYS, getPlan, getAccessState, trialEndDate, verifyUsdtPayment, tronscanUrl } from '../utils/billing.js'
import { formatDate } from '../utils/formatters.js'

export function StatusBadge() {
  const sub = useCurrentSub()
  const st = getAccessState(sub)
  if (st.status === 'pro')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-200">
        <Crown size={13} /> PRO · осталось {st.daysLeft} дн.
      </span>
    )
  if (st.status === 'trial')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-soft">
        <Clock size={13} /> Триал · осталось {st.daysLeft} дн.
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300">
      <Clock size={13} /> Доступ истёк
    </span>
  )
}

// Full billing section: reused on the /app/billing page and inside the paywall.
export default function Billing({ compact = false }) {
  const sub = useCurrentSub()
  const activatePro = useAuth((s) => s.activatePro)
  const st = getAccessState(sub)
  const [planId, setPlanId] = useState('monthly')
  const plan = getPlan(planId)
  const [tx, setTx] = useState(sub?.txHash || '')
  const [checking, setChecking] = useState(false)
  const [msg, setMsg] = useState(null) // { ok, text }
  const [copied, setCopied] = useState(false)

  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(BILLING.wallet)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = BILLING.wallet
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const check = async (e) => {
    e.preventDefault()
    setChecking(true)
    setMsg(null)
    try {
      const { timestamp } = await verifyUsdtPayment(tx, planId)
      await activatePro(tx.trim(), plan, timestamp)
      setMsg({ ok: true, text: `Оплата подтверждена в сети Tron. ${plan.title} активирован — приятной торговли!` })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge />
        {st.status === 'pro' && sub?.expiresAt && (
          <span className="text-xs text-slate-400">PRO до {formatDate(sub.expiresAt)}</span>
        )}
        {st.status === 'trial' && trialEndDate(sub) && (
          <span className="text-xs text-slate-400">Триал до {formatDate(trialEndDate(sub))}</span>
        )}
      </div>

      <div className="card bg-gradient-to-br from-amber-400/10 via-ink-900 to-brand/10 p-5">
        <h3 className="flex items-center gap-2 font-bold"><Crown size={17} className="text-amber-300" /> Тариф PRO</h3>
        <p className="mt-1 text-sm text-slate-400">
          Полный доступ ко всем возможностям сервиса: сделки без ограничений, аналитика, CRM контрагентов, импорт/экспорт.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setPlanId(p.id); setMsg(null) }}
              className={`relative rounded-2xl border p-4 text-left transition ${
                planId === p.id ? 'border-amber-400/60 bg-amber-400/10 shadow-glow' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">{p.badge}</span>
              )}
              <div className="text-sm font-bold">{p.title}</div>
              <div className="mt-1 text-2xl font-extrabold">{p.price} {BILLING.asset}</div>
              <div className="text-xs text-slate-400">≈ {p.perMonth} {BILLING.asset}/мес · {p.days} дней</div>
            </button>
          ))}
        </div>

        {!compact && (
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/30 text-xs font-bold">1</span>
              <div className="flex-1">
                <p className="text-slate-300">Отправьте ровно <b className="text-slate-900 dark:text-white">{plan.price} {BILLING.asset}</b> ({plan.title.toLowerCase()}) на кошелёк в сети <b className="text-slate-900 dark:text-white">{BILLING.network}</b>:</p>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2.5">
                  <code className="min-w-0 flex-1 break-all text-xs text-emerald-200">{BILLING.wallet}</code>
                  <button onClick={copyWallet} className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs" title="Скопировать адрес">
                    {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                    {copied ? 'Ок' : 'Копия'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-red-300/90">Важно: только {BILLING.asset} и только сеть {BILLING.network}. Монеты в других сетях будут потеряны.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/30 text-xs font-bold">2</span>
              <p className="text-slate-300">Дождитесь подтверждения сети (обычно 1–3 минуты) и скопируйте <b className="text-slate-900 dark:text-white">TXID / хеш транзакции</b> из кошелька.</p>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/30 text-xs font-bold">3</span>
              <div className="flex-1">
                <p className="mb-2 text-slate-300">Вставьте TXID ниже — сервис сам проверит перевод в блокчейне и включит PRO:</p>
                <form onSubmit={check} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input font-mono text-xs"
                    placeholder="TXID транзакции (64 символа)"
                    value={tx}
                    onChange={(e) => { setTx(e.target.value); setMsg(null) }}
                  />
                  <button type="submit" disabled={checking || !tx.trim()} className="btn-primary shrink-0">
                    {checking ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                    {checking ? 'Проверяю…' : 'Проверить оплату'}
                  </button>
                </form>
                {tx.trim() && (
                  <a href={tronscanUrl(tx.trim())} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
                    Посмотреть транзакцию в Tronscan <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </li>
          </ol>
        )}
        {msg && (
          <p className={`mt-3 rounded-xl px-3 py-2.5 text-sm ${msg.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200'}`}>
            {msg.text}
          </p>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Защита от злоупотреблений: один хеш — одна активация (повторное использование отклоняется), принимаются переводы не старше {TX_MAX_AGE_DAYS} дней.
        </p>
      </div>
    </div>
  )
}
