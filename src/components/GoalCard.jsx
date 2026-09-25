import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { calcNetProfit } from '../utils/calculations.js'
import { formatMoney } from '../utils/formatters.js'

export default function GoalCard({ deals }) {
  const goalAmount = useStore((s) => s.goalAmount)
  const setGoal = useStore((s) => s.setGoal)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  const monthNet = useMemo(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return calcNetProfit(deals.filter((d) => new Date(d.datetime) >= from))
  }, [deals])

  const monthStats = useMemo(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthDeals = deals.filter((d) => new Date(d.datetime) >= from)
    const daysElapsed = Math.max(1, now.getDate())
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const avgDay = monthNet / daysElapsed
    const forecast = avgDay * daysInMonth
    return { count: monthDeals.length, avgDay, forecast, daysLeft: daysInMonth - daysElapsed }
  }, [deals, monthNet])

  const pct = goalAmount > 0 ? Math.round((monthNet / goalAmount) * 100) : 0
  const bar = Math.max(0, Math.min(100, pct))

  const save = () => {
    setGoal(draft)
    setEditing(false)
    setDraft('')
  }

  return (
    <div className="card bg-gradient-to-br from-brand/20 via-ink-900 to-mint/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Target size={15} /> Цель месяца</h3>
        {!editing && goalAmount > 0 && (
          <button onClick={() => { setDraft(String(goalAmount)); setEditing(true) }} className="text-xs text-slate-400 hover:text-white">
            изменить
          </button>
        )}
      </div>
      {goalAmount <= 0 || editing ? (
        <div className="mt-3 flex gap-2">
          <input
            inputMode="decimal"
            className="input"
            placeholder="Цель прибыли на месяц, например 50000"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,-]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <button onClick={save} className="btn-primary shrink-0 px-4">ОК</button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className={`font-extrabold ${monthNet >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {monthNet >= 0 ? '+' : ''}{formatMoney(Math.round(monthNet))}
            </span>
            <span className="text-slate-400">из {formatMoney(goalAmount)} · {pct}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-brand to-brand-soft'}`}
              style={{ width: `${bar}%` }}
            />
          </div>
          {pct >= 100 && <p className="mt-1 text-xs font-bold text-emerald-300">Цель выполнена! 🎯</p>}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">
              <div className="text-slate-400">Осталось</div>
              <div className="text-sm font-extrabold">{formatMoney(Math.max(0, Math.round(goalAmount - monthNet)))}</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">
              <div className="text-slate-400">Дней осталось</div>
              <div className="text-sm font-extrabold">{monthStats.daysLeft}</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">
              <div className="text-slate-400">Среднее в день</div>
              <div className={`text-sm font-extrabold ${monthStats.avgDay >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {monthStats.avgDay >= 0 ? '+' : ''}{formatMoney(Math.round(monthStats.avgDay))}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">
              <div className="text-slate-400">Прогноз на месяц</div>
              <div className={`text-sm font-extrabold ${monthStats.forecast >= goalAmount ? 'text-emerald-300' : 'text-amber-200'}`}>
                {monthStats.forecast >= 0 ? '+' : ''}{formatMoney(Math.round(monthStats.forecast))}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Сделок в месяце: {monthStats.count} · {monthStats.forecast >= goalAmount ? 'Идёшь с опережением графика ✓' : 'Нужно ускориться, чтобы успеть'}
          </p>
        </div>
      )}
    </div>
  )
}
