import { useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { dealFiatTotal } from '../utils/calculations.js'
import { formatMoney } from '../utils/formatters.js'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function aggregate(list) {
  let buy = 0
  let buyRaw = 0
  let sell = 0
  let fees = 0
  for (const d of list) {
    const total = dealFiatTotal(d)
    const fee = Number(d.fee) || 0
    fees += fee
    if (d.type === 'buy') {
      buy += total + fee
      buyRaw += total
    } else sell += total - fee
  }
  const net = sell - buy
  return {
    buy,
    sell,
    fees,
    deals: list.length,
    net,
    // Spread w/o fees (price edge), ROI with fees (bottom line).
    spread: buyRaw > 0 ? ((sell - buyRaw) / buyRaw) * 100 : null,
    roi: buy > 0 ? (net / buy) * 100 : null,
  }
}

const r2 = (n) => Math.round(n * 100) / 100

export default function MonthlyReport({ deals }) {
  const now = new Date()
  const years = useMemo(() => {
    const set = new Set(deals.map((d) => new Date(d.datetime).getFullYear()))
    set.add(now.getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [deals])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const { rows, total } = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const rows = []
    for (let day = 1; day <= daysInMonth; day++) {
      const list = deals.filter((d) => {
        const dt = new Date(d.datetime)
        return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === day
      })
      rows.push({ day, ...aggregate(list) })
    }
    const all = deals.filter((d) => {
      const dt = new Date(d.datetime)
      return dt.getFullYear() === year && dt.getMonth() === month
    })
    return { rows, total: aggregate(all) }
  }, [deals, year, month])

  const exportCSV = () => {
    const head = ['Дата', 'Покупки', 'Продажи', 'Комиссии', 'Чистая прибыль', 'Спред %', 'ROI %', 'Сделок']
    const lines = [head.join(';')]
    for (const r of rows) {
      lines.push(
        [
          `${String(r.day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`,
          r2(r.buy),
          r2(r.sell),
          r2(r.fees),
          r2(r.net),
          r.spread === null ? '' : r2(r.spread),
          r.roi === null ? '' : r2(r.roi),
          r.deals,
        ].join(';'),
      )
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spreadbook-${year}-${String(month + 1).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = rows.some((r) => r.deals > 0)

  const cell = (v, nullText = '—') =>
    v === null ? <span className="text-slate-600">{nullText}</span> : v

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold">Сводка по дням</h3>
          <p className="text-xs text-slate-500">Покупки, продажи, спред и чистая прибыль за каждый день месяца</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {hasData && (
            <button onClick={exportCSV} className="btn-ghost px-3 py-1.5 text-xs">
              <FileSpreadsheet size={14} /> CSV
            </button>
          )}
        </div>
      </div>
      {!hasData ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          В {MONTHS[month].toLowerCase()} {year} сделок нет — сводка появится, когда добавите.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  {['Дата', 'Покупки', 'Продажи', 'Комиссии', 'Чистая прибыль', 'Спред', 'ROI', 'Сделок'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day} className={`border-t border-white/5 hover:bg-white/[0.03] ${r.deals === 0 ? 'opacity-50' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-2 font-bold">
                      {String(r.day).padStart(2, '0')}.{String(month + 1).padStart(2, '0')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-red-300">{r.deals ? `−${formatMoney(Math.round(r.buy))}` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-emerald-300">{r.deals ? `+${formatMoney(Math.round(r.sell))}` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{r.deals ? formatMoney(Math.round(r.fees)) : '—'}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 font-extrabold ${!r.deals ? '' : r.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {!r.deals ? '—' : `${r.net >= 0 ? '+' : ''}${formatMoney(Math.round(r.net))}`}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 ${r.spread === null ? '' : r.spread >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {cell(r.spread === null ? null : `${r.spread >= 0 ? '+' : ''}${r.spread.toFixed(2)}%`)}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 ${r.roi === null ? '' : r.roi >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {cell(r.roi === null ? null : `${r.roi >= 0 ? '+' : ''}${r.roi.toFixed(2)}%`)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{r.deals || '—'}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-white/15 bg-white/[0.04] font-bold">
                  <td className="whitespace-nowrap px-4 py-2.5">Итого</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-red-300">−{formatMoney(Math.round(total.buy))}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-emerald-300">+{formatMoney(Math.round(total.sell))}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{formatMoney(Math.round(total.fees))}</td>
                  <td className={`whitespace-nowrap px-4 py-2.5 font-extrabold ${total.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {total.net >= 0 ? '+' : ''}{formatMoney(Math.round(total.net))}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2.5 ${total.spread === null ? '' : total.spread >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {cell(total.spread === null ? null : `${total.spread >= 0 ? '+' : ''}${total.spread.toFixed(2)}%`)}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2.5 ${total.roi === null ? '' : total.roi >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {cell(total.roi === null ? null : `${total.roi >= 0 ? '+' : ''}${total.roi.toFixed(2)}%`)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{total.deals}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {rows.filter((r) => r.deals > 0).map((r) => (
              <div key={r.day} className="rounded-xl border border-white/10 bg-ink-950/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{String(r.day).padStart(2, '0')}.{String(month + 1).padStart(2, '0')}.{year}</span>
                  <span className={`font-extrabold ${r.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {r.net >= 0 ? '+' : ''}{formatMoney(Math.round(r.net))}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-400">
                  <span>Покупки: <b className="text-red-300">−{formatMoney(Math.round(r.buy))}</b></span>
                  <span>Продажи: <b className="text-emerald-300">+{formatMoney(Math.round(r.sell))}</b></span>
                  <span>Комиссии: {formatMoney(Math.round(r.fees))}</span>
                  <span>Сделок: {r.deals}</span>
                  <span>Спред: {r.spread === null ? '—' : `${r.spread.toFixed(2)}%`}</span>
                  <span>ROI: {r.roi === null ? '—' : `${r.roi.toFixed(2)}%`}</span>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">Итого за месяц</span>
                <span className={`font-extrabold ${total.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {total.net >= 0 ? '+' : ''}{formatMoney(Math.round(total.net))}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Сделок: {total.deals} · спред {total.spread === null ? '—' : `${total.spread.toFixed(2)}%`} · ROI {total.roi === null ? '—' : `${total.roi.toFixed(2)}%`}</div>
            </div>
          </div>
          <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
            Суммы агрегируют все фиатные валюты. Спред — ценовой перевес без комиссий; ROI — итог с комиссиями.
          </p>
        </>
      )}
    </div>
  )
}
