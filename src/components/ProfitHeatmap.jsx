import { useMemo } from 'react'
import { dealNetValue } from '../utils/calculations.js'
import { formatMoney } from '../utils/formatters.js'

// GitHub-style profit heatmap: last 12 weeks, columns = weeks (Mon–Sun).
export default function ProfitHeatmap({ deals }) {
  const { weeks, maxPos, maxNeg, total } = useMemo(() => {
    const byDay = new Map()
    let total = 0
    for (const d of deals) {
      const key = new Date(d.datetime).toISOString().slice(0, 10)
      const v = dealNetValue(d)
      byDay.set(key, (byDay.get(key) || 0) + v)
      total += v
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Align start to Monday, 12 weeks back.
    const start = new Date(today)
    const dow = (start.getDay() + 6) % 7 // 0 = Monday
    start.setDate(start.getDate() - dow - 7 * 11)
    const weeks = []
    let maxPos = 0
    let maxNeg = 0
    for (let w = 0; w < 12; w++) {
      const days = []
      for (let i = 0; i < 7; i++) {
        const dt = new Date(start)
        dt.setDate(start.getDate() + w * 7 + i)
        const future = dt > today
        const key = dt.toISOString().slice(0, 10)
        const v = future ? null : byDay.get(key) || 0
        if (v !== null) {
          if (v > maxPos) maxPos = v
          if (v < maxNeg) maxNeg = v
        }
        days.push({ date: dt, value: v })
      }
      weeks.push(days)
    }
    return { weeks, maxPos, maxNeg, total }
  }, [deals])

  const color = (v) => {
    if (v === null) return 'bg-transparent'
    if (v === 0) return 'bg-white/5'
    if (v > 0) {
      const t = maxPos > 0 ? v / maxPos : 0
      return t > 0.66 ? 'bg-emerald-500' : t > 0.33 ? 'bg-emerald-500/60' : 'bg-emerald-500/25'
    }
    const t = maxNeg < 0 ? v / maxNeg : 0
    return t > 0.66 ? 'bg-red-500' : t > 0.33 ? 'bg-red-500/60' : 'bg-red-500/25'
  }

  return (
    <div className="card p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">Календарь прибыли · 12 недель</h3>
        <span className={`text-sm font-bold ${total >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
          {total >= 0 ? '+' : ''}{formatMoney(Math.round(total * 100) / 100)}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">Зелёный — дни в плюс, красный — в минус. Ярче = больше сумма.</p>
      <div className="overflow-x-auto pb-1">
        <div className="flex w-fit gap-1">
          {weeks.map((days, w) => (
            <div key={w} className="grid gap-1">
              {days.map((d, i) => (
                <div
                  key={i}
                  title={`${d.date.toLocaleDateString('ru-RU')}: ${d.value === null ? '—' : formatMoney(Math.round(d.value * 100) / 100)}`}
                  className={`h-3.5 w-3.5 rounded-[3px] sm:h-4 sm:w-4 ${color(d.value)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
        меньше
        <span className="h-2.5 w-2.5 rounded-[3px] bg-white/5" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500/25" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500/60" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500" />
        больше
      </div>
    </div>
  )
}
