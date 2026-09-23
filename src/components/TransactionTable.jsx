import { useMemo, useState } from 'react'
import { Pencil, Trash2, Search } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { formatDateTime, formatMoney } from '../utils/formatters.js'
import { dealFiatTotal } from '../utils/calculations.js'
import DealForm from './DealForm.jsx'

const PAGE_SIZE = 20

export default function TransactionTable({ deals }) {
  const deleteDeal = useStore((s) => s.deleteDeal)
  const [q, setQ] = useState('')
  const [typeF, setTypeF] = useState('all')
  const [assetF, setAssetF] = useState('all')
  const [platF, setPlatF] = useState('all')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)

  const assets = useMemo(() => [...new Set(deals.map((d) => d.asset))], [deals])
  const plats = useMemo(() => [...new Set(deals.map((d) => d.platform))], [deals])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return deals
      .filter((d) => (typeF === 'all' ? true : d.type === typeF))
      .filter((d) => (assetF === 'all' ? true : d.asset === assetF))
      .filter((d) => (platF === 'all' ? true : d.platform === platF))
      .filter((d) =>
        needle
          ? [d.counterparty, d.notes, d.asset, d.platform, d.fiat].join(' ').toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
  }, [deals, q, typeF, assetF, platF])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pages - 1)
  const rows = filtered.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Поиск: контрагент, заметка, актив…" className="input pl-9" />
        </div>
        <select className="input w-auto" value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(0) }}>
          <option value="all">Все типы</option>
          <option value="buy">Покупки</option>
          <option value="sell">Продажи</option>
        </select>
        <select className="input w-auto" value={assetF} onChange={(e) => { setAssetF(e.target.value); setPage(0) }}>
          <option value="all">Все активы</option>
          {assets.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="input w-auto" value={platF} onChange={(e) => { setPlatF(e.target.value); setPage(0) }}>
          <option value="all">Все площадки</option>
          {plats.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              {['Дата', 'Тип', 'Актив', 'Кол-во', 'Курс', 'Сумма', 'Площадка', 'Контрагент', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-300">{formatDateTime(d.datetime)}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${d.type === 'buy' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                    {d.type === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-semibold">{d.asset}<span className="text-slate-500">/{d.fiat}</span></td>
                <td className="px-4 py-2.5">{d.amount}</td>
                <td className="px-4 py-2.5">{formatMoney(d.price)}</td>
                <td className="px-4 py-2.5 font-semibold">{formatMoney(dealFiatTotal(d), d.fiat)}</td>
                <td className="px-4 py-2.5"><span className="rounded-md bg-white/5 px-2 py-0.5 text-xs">{d.platform}</span></td>
                <td className="max-w-[160px] truncate px-4 py-2.5 text-slate-300">{d.counterparty || '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <button className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => setEditing(d)} title="Редактировать"><Pencil size={15} /></button>
                  <button
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                    title="Удалить"
                    onClick={() => { if (window.confirm('Удалить сделку?')) deleteDeal(d.id) }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Ничего не найдено. Добавьте первую сделку выше.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 p-3 md:hidden">
        {rows.map((d) => (
          <div key={d.id} className="rounded-xl border border-white/10 bg-ink-950/60 p-3">
            <div className="flex items-center justify-between">
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${d.type === 'buy' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                {d.type === 'buy' ? 'ПОКУПКА' : 'ПРОДАЖА'} · {d.asset}/{d.fiat}
              </span>
              <span className="text-xs text-slate-500">{formatDateTime(d.datetime)}</span>
            </div>
            <div className="mt-2 text-sm">
              <span className="font-bold">{d.amount} {d.asset}</span>
              <span className="text-slate-400"> по {formatMoney(d.price)} = </span>
              <span className="font-bold">{formatMoney(dealFiatTotal(d), d.fiat)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>{d.platform} · {d.counterparty || '—'}</span>
              <span className="flex gap-1">
                <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setEditing(d)}><Pencil size={14} /></button>
                <button className="rounded-lg p-1.5 hover:bg-red-500/20" onClick={() => { if (window.confirm('Удалить сделку?')) deleteDeal(d.id) }}><Trash2 size={14} /></button>
              </span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Ничего не найдено.</p>}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-slate-400">
        <span>Всего: {filtered.length} · стр. {cur + 1}/{pages}</span>
        <div className="flex gap-2">
          <button className="btn-ghost px-3 py-1.5 text-xs" disabled={cur === 0} onClick={() => setPage(cur - 1)}>← Назад</button>
          <button className="btn-ghost px-3 py-1.5 text-xs" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Вперед →</button>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70" onClick={() => setEditing(null)}>
          <div className="grid min-h-full place-items-center p-4">
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <DealForm initial={editing} onDone={() => setEditing(null)} />
              <button className="btn-ghost mt-3 w-full" onClick={() => setEditing(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
