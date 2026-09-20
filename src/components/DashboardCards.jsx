import { Wallet, TrendingUp, Percent, ArrowDownUp } from 'lucide-react'
import { formatMoney } from '../utils/formatters.js'
import { calcVolume, calcNetProfit, calcROI, calcAvgPrices, calcFees } from '../utils/calculations.js'

const PERIODS = [
  ['day', 'День'],
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['year', 'Год'],
  ['all', 'Всё время'],
]

export function PeriodSwitch({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-ink-900/70 p-1.5">
      {PERIODS.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
            value === v ? 'bg-gradient-to-r from-brand to-brand-soft text-white shadow-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function DashboardCards({ deals, period, onPeriod }) {
  const volume = calcVolume(deals)
  const profit = calcNetProfit(deals)
  const roi = calcROI(deals)
  const { avgBuy, avgSell } = calcAvgPrices(deals)
  const fees = calcFees(deals)

  const cards = [
    {
      icon: <Wallet size={18} />,
      title: 'Общий объем торгов',
      value: formatMoney(volume),
      sub: `${deals.length} сделок · комиссии ${formatMoney(fees)}`,
      grad: 'from-brand/40 to-brand/5',
    },
    {
      icon: <TrendingUp size={18} />,
      title: 'Чистая прибыль (cash-flow)',
      value: `${profit >= 0 ? '+' : ''}${formatMoney(profit)}`,
      sub: 'Продажи − покупки − комиссии*',
      accent: profit >= 0 ? 'text-emerald-300' : 'text-red-300',
      grad: profit >= 0 ? 'from-emerald-500/30 to-emerald-500/5' : 'from-red-500/30 to-red-500/5',
    },
    {
      icon: <ArrowDownUp size={18} />,
      title: 'Средние курсы',
      value: `${formatMoney(avgSell)} / ${formatMoney(avgBuy)}`,
      sub: 'выход / вход (средневзвеш.)',
      grad: 'from-mint/30 to-mint/5',
    },
    {
      icon: <Percent size={18} />,
      title: 'ROI за период',
      value: `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`,
      sub: 'прибыль / объем покупок',
      accent: roi >= 0 ? 'text-emerald-300' : 'text-red-300',
      grad: 'from-violet-500/30 to-violet-500/5',
    },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Метрики</h2>
        <PeriodSwitch value={period} onChange={onPeriod} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className={`card bg-gradient-to-br p-4 ${c.grad}`}>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white">{c.icon}</span>
              {c.title}
            </div>
            <div className={`mt-2 text-xl font-extrabold tracking-tight ${c.accent || 'text-white'}`}>{c.value}</div>
            <div className="mt-1 text-xs text-slate-400">{c.sub}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        * Упрощенная cash-flow модель MVP: прибыль = Σ(продажи − комиссия) − Σ(покупки + комиссия). Без переоценки открытых позиций и FIFO/LIFO.
      </p>
    </div>
  )
}
