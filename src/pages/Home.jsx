import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useAuth, useCurrentSub } from '../store/useAuth.js'
import { filterByPeriod } from '../utils/calculations.js'
import { getAccessState } from '../utils/billing.js'
import DashboardCards from '../components/DashboardCards.jsx'
import ChartsSection from '../components/ChartsSection.jsx'

// Cabinet home: pure dashboard, no presentation hero (it lives on Landing).
export default function Home() {
  const deals = useStore((s) => s.deals)
  const period = useStore((s) => s.period)
  const setPeriod = useStore((s) => s.setPeriod)
  const user = useAuth((s) => s.user)
  const sub = useCurrentSub()
  const access = getAccessState(sub)

  const scoped = useMemo(() => filterByPeriod(deals, period), [deals, period])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Привет, {user?.name || 'трейдер'} 👋
        </h1>
        <p className="text-sm text-slate-400">Ваш дашборд: прибыль, объемы и динамика капитала.</p>
      </div>
      {access.status === 'trial' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-mint/25 bg-mint/10 px-4 py-2.5 text-sm">
          <span className="text-mint-soft">Пробный доступ: осталось {access.daysLeft} дн. Затем понадобится PRO-подписка.</span>
          <Link to="/app/billing" className="rounded-lg bg-mint/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-mint/30">
            Тарифы
          </Link>
        </div>
      )}
      <DashboardCards deals={scoped} period={period} onPeriod={setPeriod} />
      <ChartsSection deals={scoped} />
    </div>
  )
}
