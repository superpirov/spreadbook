import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { buildEquityCurve, groupByPlatform, groupByPair } from '../utils/calculations.js'

const COLORS = ['#3131ff', '#518b7b', '#8b8bff', '#6fae9c', '#b388ff', '#4dd0a6', '#7c6cff', '#3ddc97']

const tipStyle = {
  background: '#242b38',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  fontSize: 12,
  color: '#fff',
}

export default function ChartsSection({ deals }) {
  const equity = buildEquityCurve(deals)
  const byPlatform = groupByPlatform(deals)
  const byPair = groupByPair(deals)

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <div className="card p-4">
        <h3 className="mb-1 text-sm font-bold">Динамика капитала (Equity Curve)</h3>
        <p className="mb-3 text-xs text-slate-500">Накопленный cash-flow по дням</p>
        {equity.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={equity}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8b93a7', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#8b93a7', fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="profit" name="Профит" stroke="#6f7bff" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-4">
        <h3 className="mb-1 text-sm font-bold">Распределение по площадкам</h3>
        <p className="mb-3 text-xs text-slate-500">Объем в фиате (сумма сделок)</p>
        {byPlatform.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byPlatform} dataKey="value" nameKey="name" outerRadius={95} paddingAngle={3}>
                {byPlatform.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <Legend items={byPlatform} />
      </div>

      <div className="card p-4 xl:col-span-2">
        <h3 className="mb-1 text-sm font-bold">Статистика по парам</h3>
        <p className="mb-3 text-xs text-slate-500">Топ пар по объему</p>
        {byPair.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byPair} layout="vertical">
              <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8b93a7', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#cbd2e1', fontSize: 12 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="value" name="Объем" fill="#518b7b" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function Empty() {
  return <p className="grid h-[260px] place-items-center text-sm text-slate-500">Нет данных для графика</p>
}

function Legend({ items }) {
  if (!items.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      {items.map((it, i) => (
        <span key={it.name} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
          {it.name} · {it.value.toLocaleString('ru-RU')}
        </span>
      ))}
    </div>
  )
}
