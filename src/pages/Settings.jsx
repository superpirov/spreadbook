import { useRef, useState } from 'react'
import { Download, Upload, Trash2, FileSpreadsheet } from 'lucide-react'
import { useStore } from '../store/useStore.js'

function toCSV(deals) {
  const head = ['id', 'datetime', 'type', 'asset', 'fiat', 'amount', 'price', 'fee', 'platform', 'counterparty', 'notes']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [head.join(',')]
  for (const d of deals) lines.push(head.map((k) => esc(d[k])).join(','))
  return '﻿' + lines.join('\n')
}

export default function Settings() {
  const deals = useStore((s) => s.deals)
  const ratings = useStore((s) => s.ratings)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const fileRef = useRef(null)
  const [msg, setMsg] = useState('')

  const download = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportJSON = () => {
    download(`spreadbook-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'SpreadBook', version: 1, exportedAt: new Date().toISOString(), deals, ratings }, null, 2), 'application/json')
    setMsg('JSON-дамп скачан.')
  }

  const exportCSV = () => {
    download(`spreadbook-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(deals), 'text/csv;charset=utf-8')
    setMsg('CSV выгружен (открывается в Excel).')
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const text = await f.text()
      const payload = JSON.parse(text)
      if (!Array.isArray(payload.deals)) throw new Error('bad format')
      if (!window.confirm(`Импортировать ${payload.deals.length} сделок? Текущие данные будут ПЕРЕЗАПИСАНЫ.`)) return
      importData(payload)
      setMsg(`Импортировано сделок: ${payload.deals.length}.`)
    } catch {
      setMsg('Ошибка: файл не похож на выгрузку SpreadBook (нужен JSON с полем deals[]).')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Импорт / Экспорт</h1>
        <p className="text-sm text-slate-400">Данные живут только в вашем браузере (localStorage). Делайте бэкапы.</p>
      </div>
      <div className="card p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <button onClick={exportJSON} className="btn-primary"><Download size={16} /> Export JSON</button>
          <button onClick={exportCSV} className="btn-mint"><FileSpreadsheet size={16} /> Export CSV</button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost"><Upload size={16} /> Import JSON</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        {msg && <p className="mt-3 text-sm text-slate-300">{msg}</p>}
        <dl className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
          <div className="rounded-xl bg-white/[0.04] p-3"><dt className="text-xs uppercase">Сделок</dt><dd className="text-lg font-bold text-white">{deals.length}</dd></div>
          <div className="rounded-xl bg-white/[0.04] p-3"><dt className="text-xs uppercase">Контрагентов с рейтингом</dt><dd className="text-lg font-bold text-white">{Object.keys(ratings).length}</dd></div>
          <div className="rounded-xl bg-white/[0.04] p-3"><dt className="text-xs uppercase">Хранилище</dt><dd className="text-lg font-bold text-white">localStorage</dd></div>
        </dl>
      </div>
      <div className="card border-red-500/20 p-5">
        <h3 className="text-sm font-bold text-red-300">Опасная зона</h3>
        <p className="mt-1 text-xs text-slate-400">Удалить все сделки и рейтинги из этого браузера без возможности восстановления.</p>
        <button
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/25"
          onClick={() => { if (window.confirm('Точно удалить ВСЕ данные? Сделайте бэкап!')) { resetAll(); setMsg('Все данные удалены.') } }}
        >
          <Trash2 size={16} /> Удалить все данные
        </button>
      </div>
    </div>
  )
}
