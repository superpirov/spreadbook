import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, PartyPopper } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { useAuth, useCurrentSub } from '../store/useAuth.js'
import { filterByPeriod } from '../utils/calculations.js'
import { getAccessState } from '../utils/billing.js'
import DashboardCards from '../components/DashboardCards.jsx'
import ChartsSection from '../components/ChartsSection.jsx'
import ProfitHeatmap from '../components/ProfitHeatmap.jsx'
import GoalCard from '../components/GoalCard.jsx'
import MonthlyReport from '../components/MonthlyReport.jsx'

// Cabinet home: pure dashboard, no presentation hero (it lives on Landing).
export default function Home() {
  const deals = useStore((s) => s.deals)
  const period = useStore((s) => s.period)
  const setPeriod = useStore((s) => s.setPeriod)
  const user = useAuth((s) => s.user)
  const sub = useCurrentSub()
  const access = getAccessState(sub)
  const watchlist = useStore((s) => s.watchlist)
  const ackWatch = useStore((s) => s.ackWatch)
  const alerts = watchlist.filter((w) => !w.ack && w.lastVerdict === 'bad')
  const [welcomed, setWelcomed] = useState(() => {
    try {
      return localStorage.getItem(`spreadbook-welcomed-${user?.id || 'none'}`) === '1'
    } catch {
      return true
    }
  })
  const dismissWelcome = () => {
    try {
      localStorage.setItem(`spreadbook-welcomed-${user?.id || 'none'}`, '1')
    } catch {
      /* ignore */
    }
    setWelcomed(true)
  }

  const scoped = useMemo(() => filterByPeriod(deals, period), [deals, period])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Привет, {user?.name || 'трейдер'} 👋
        </h1>
        <p className="text-sm text-slate-400">Ваш дашборд: прибыль, объемы и динамика капитала.</p>
      </div>
      {alerts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-red-200">
            <ShieldAlert size={16} /> Мониторинг: {alerts.length} адрес {alerts.length === 1 ? 'стал' : 'стали'} опасным: {alerts.slice(0, 2).map((w) => w.address.slice(0, 6) + '…' + w.address.slice(-4)).join(', ')}
          </span>
          <span className="flex gap-2">
            <Link to="/app/aml" className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/30">
              Открыть AML
            </Link>
            <button onClick={() => alerts.forEach((w) => ackWatch(w.address))} className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white">
              Понятно
            </button>
          </span>
        </div>
      )}
      {!welcomed && (
        <div className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/15 via-ink-900 to-mint/10 p-5">
          <h2 className="flex items-center gap-2 text-base font-extrabold">
            <PartyPopper size={18} className="text-amber-300" /> Добро пожаловать в SpreadBook, {user?.name || 'трейдер'}!
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Регистрация прошла успешно — мы отправили письмо для подтверждения почты (загляните и в спам).
            У вас 3 дня полного доступа: записывайте сделки, смотрите аналитику, проверяйте кошельки.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/app/guide" className="btn-primary px-4 py-2 text-xs">Обзор площадки</Link>
            <Link to="/app/deals" className="btn-ghost px-4 py-2 text-xs">Первая сделка</Link>
            <button onClick={dismissWelcome} className="px-3 py-2 text-xs text-slate-400 hover:text-white">Уже освоился</button>
          </div>
        </div>
      )}
      {access.status === 'trial' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-mint/25 bg-mint/10 px-4 py-2.5 text-sm">
          <span className="text-mint-soft">Пробный доступ: осталось {access.daysLeft} дн. Затем понадобится PRO-подписка.</span>
          <Link to="/app/billing" className="rounded-lg bg-mint/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-mint/30">
            Тарифы
          </Link>
        </div>
      )}
      <DashboardCards deals={scoped} period={period} onPeriod={setPeriod} />
      <div className="grid gap-3 xl:grid-cols-2">
        <GoalCard deals={deals} />
        <ProfitHeatmap deals={scoped} />
      </div>
      <ChartsSection deals={scoped} />
      <MonthlyReport deals={deals} />
    </div>
  )
}
