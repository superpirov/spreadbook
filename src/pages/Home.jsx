import { useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../store/useAuth.js'
import { filterByPeriod } from '../utils/calculations.js'
import DashboardCards from '../components/DashboardCards.jsx'
import ChartsSection from '../components/ChartsSection.jsx'

// Cabinet home: pure dashboard, no presentation hero (it lives on Landing).
export default function Home() {
  const deals = useStore((s) => s.deals)
  const period = useStore((s) => s.period)
  const setPeriod = useStore((s) => s.setPeriod)
  const isDemo = useStore((s) => s.isDemo)
  const clearDemo = useStore((s) => s.clearDemo)
  const user = useAuth((s) => s.user)

  const scoped = useMemo(() => filterByPeriod(deals, period), [deals, period])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Привет, {user?.name || 'трейдер'} 👋
        </h1>
        <p className="text-sm text-slate-400">Ваш дашборд: прибыль, объемы и динамика капитала.</p>
      </div>
      {isDemo && deals.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-sm">
          <span className="text-amber-200">Загружены демо-данные, чтобы показать графики.</span>
          <button onClick={() => { if (window.confirm('Удалить демо-сделки?')) clearDemo() }} className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/30">
            Очистить демо-данные
          </button>
        </div>
      )}
      <DashboardCards deals={scoped} period={period} onPeriod={setPeriod} />
      <ChartsSection deals={scoped} />
    </div>
  )
}
