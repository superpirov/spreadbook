import { useMemo } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { dealFiatTotal } from '../utils/calculations.js'
import { formatMoney } from '../utils/formatters.js'

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function monthRows(deals) {
  const map = new Map()
  for (const d of deals) {
    const dt = new Date(d.datetime)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) {
      map.set(key, { key, year: dt.getFullYear(), month: dt.getMonth(), buy: 0, buyRaw: 0, sell: 0, fees: 0, deals: 0 })
    }
    const e = map.get(key)
    const total = dealFiatTotal(d)
    const fee = Number(d.fee) || 0
    e.fees += fee
    e.deals += 1
    if (d.type === 'buy') {
      e.buy += total + fee
      e.buyRaw += total
    } else e.sell += total - fee
  }
  return [...map.values()]
    .map((e) => {
      const net = e.sell - e.buy
      // Spread w/o fees (price edge), ROI with fees (bottom line).
      const spread = e.buyRaw > 0 ? ((e.sell - e.buyRaw) / e.buyRaw) * 100 : null
      const roi = e.buy > 0 ? (net / e.buy) * 100 : null
      return { ...e, net, spread, roi }
    })
    .sort((a, b) => (a.key < b.key ? 1 : -1))
}

export default function MonthlyReport({ deals }) {
  const rows = useMemo(() => monthRows(deals), [deals])

  const exportCSV = () => {
    const head = ['Месяц', 'Покупки', 'Продажи', 'Комиссии', 'Чистая прибыль', 'Спред %', 'ROI %', 'Сделок']
    const lines = [head.join(';')]
    for (const r of rows) {
      lines.push(
        [
          `${MONTHS[r.month]} ${r.year}`,
          Math.round(r.buy * 100) / 100,
          Math.round(r.sell * 100) / 100,
          Math.round(r.fees * 100) / 100,
          Math.round(r.net * 100) / 100,
          r.spread === null ? '' : Math.round(r.spread * 100) / 100,
          r.roi === null ? '' : Math.round(r.roi * 100) / 100,
          r.deals,
        ].join(';'),
      )
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spreadbook-monthly-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold">Сводка по месяцам</h3>
          <p className="text-xs text-slate-500">Покупки, продажи, спред и чистая прибыль за каждый календарный месяц</p>
        </div>
        {rows.length > 0 && (
          <button onClick={exportCSV} className="btn-ghost px-3 py-1.5 text-xs">
            <FileSpreadsheet size={14} /> CSV
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Пока нет сделок — сводка появится здесь.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  {['Месяц', 'Покупки', 'Продажи', 'Комиссии', 'Чистая прибыль', 'Спред', 'ROI', 'Сделок'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-4 py-2.5 font-bold">{MONTHS[r.month]} {r.year}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-red-300">−{formatMoney(Math.round(r.buy))}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-emerald-300">+{formatMoney(Math.round(r.sell))}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{formatMoney(Math.round(r.fees))}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 font-extrabold ${r.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {r.net >= 0 ? '+' : ''}{formatMoney(Math.round(r.net))}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 ${r.spread === null ? 'text-slate-600' : r.spread >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {r.spread === null ? '—' : `${r.spread >= 0 ? '+' : ''}${r.spread.toFixed(2)}%`}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 ${r.roi === null ? 'text-slate-600' : r.roi >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {r.roi === null ? '—' : `${r.roi >= 0 ? '+' : ''}${r.roi.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{r.deals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {rows.map((r) => (
              <div key={r.key} className="rounded-xl border border-white/10 bg-ink-950/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{MONTHS[r.month]} {r.year}</span>
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
          </div>
          <p className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
            Суммы агрегируют все фиатные валюты. Спред — ценовой перевес без комиссий; ROI — итог с комиссиями.
          </p>
        </>
      )}
    </div>
  )
}
