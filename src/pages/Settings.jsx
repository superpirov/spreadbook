import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Trash2, FileSpreadsheet, Cloud, CloudOff, Loader2, KeyRound, Save } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../store/useAuth.js'
import { P2P_EXCHANGES, loadExKeys, saveExKey, deleteExKey } from '../utils/exkeys.js'

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
  const knownCounterparties = useStore((s) => s.knownCounterparties)
  const profiles = useStore((s) => s.profiles)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const cloudReady = useStore((s) => s.cloudReady)
  const cloudError = useStore((s) => s.cloudError)
  const user = useAuth((s) => s.user)
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
    download(`spreadbook-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'SpreadBook', version: 2, exportedAt: new Date().toISOString(), deals, ratings, knownCounterparties, profiles }, null, 2), 'application/json')
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
        <p className="text-sm text-slate-400">Данные синхронизируются между устройствами через облако. Бэкап в файл — дополнительная страховка.</p>
      </div>
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Синхронизация</h3>
          {cloudError ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-200">
              <CloudOff size={13} /> Нет связи с облаком
            </span>
          ) : cloudReady ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200">
              <Cloud size={13} /> Облако подключено
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-400">
              <Loader2 size={13} className="animate-spin" /> Подключение…
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Аккаунт: {user?.email || '—'} · {cloudError ? 'Показаны локальные данные. Проверьте Rules Firestore и интернет, затем обновите страницу.' : 'Все изменения на этом устройстве автоматически появляются на других.'}
        </p>
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
          <div className="rounded-xl bg-white/[0.04] p-3"><dt className="text-xs uppercase">Хранилище</dt><dd className="text-lg font-bold text-white">Firestore + кэш</dd></div>
        </dl>
      </div>
      <ExKeysCard />
      <div className="card border-red-500/20 p-5">
        <h3 className="text-sm font-bold text-red-300">Опасная зона</h3>
        <p className="mt-1 text-xs text-slate-400">Удалить все сделки, контакты и реквизиты везде — на всех устройствах. Без возможности восстановления.</p>
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

function ExKeysCard() {
  const user = useAuth((s) => s.user)
  const [keys, setKeys] = useState({})
  const [drafts, setDrafts] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!user) return
    loadExKeys(user.id).then(setKeys).catch(() => setMsg('Ключи не загрузились. Проверьте rules (exkeys).'))
  }, [user])

  const set = (ex, field, value) => setDrafts((d) => ({ ...d, [ex]: { ...d[ex], [field]: value } }))

  const save = async (ex) => {
    const cur = { ...(keys[ex] || {}), ...(drafts[ex] || {}) }
    if (!Object.values(cur).some((v) => String(v || '').trim())) {
      setMsg('Заполните хотя бы одно поле ключа.')
      return
    }
    setBusy(ex)
    try {
      await saveExKey(user.id, ex, cur)
      setKeys((k) => ({ ...k, [ex]: cur }))
      setDrafts((d) => ({ ...d, [ex]: {} }))
      setMsg(`Ключ ${ex} сохранён в вашем облаке.`)
    } catch {
      setMsg('Не удалось сохранить. Проверьте rules Firestore (exkeys).')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (ex) => {
    if (!window.confirm(`Удалить ключ ${ex}?`)) return
    try {
      await deleteExKey(user.id, ex)
      setKeys((k) => {
        const c = { ...k }
        delete c[ex]
        return c
      })
      setMsg(`Ключ ${ex} удалён.`)
    } catch {
      setMsg('Не удалось удалить.')
    }
  }

  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold"><KeyRound size={15} /> Биржевые API-ключи (P2P-стаканы)</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Только ваши личные ключи — хранятся в вашем облаке и используются только из вашего браузера.
        Создавайте ключи с минимальными правами (чтение P2P), <b className="text-red-300">без права на вывод и торговлю</b>.
        Для Bybit дополнительно нужен статус P2P-рекламодателя.
      </p>
      <div className="mt-3 space-y-3">
        {P2P_EXCHANGES.map((ex) => (
          <div key={ex.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{ex.name}</span>
              {keys[ex.id] ? (
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-200">добавлен</span>
              ) : (
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-400">нет</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{ex.hint}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ex.fields.map((f) => (
                <input
                  key={f}
                  type="password"
                  autoComplete="off"
                  placeholder={f === 'apiKey' ? 'API Key' : f === 'apiSecret' ? 'API Secret' : 'Токен'}
                  className="input font-mono text-xs"
                  value={drafts[ex.id]?.[f] ?? (keys[ex.id]?.[f] ? '••••••••' : '')}
                  onChange={(e) => set(ex.id, f, e.target.value)}
                  onFocus={(e) => { if (e.target.value === '••••••••') set(ex.id, f, '') }}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button disabled={busy === ex.id} onClick={() => save(ex.id)} className="btn-ghost px-3 py-1.5 text-xs">
                <Save size={13} /> {busy === ex.id ? '…' : 'Сохранить'}
              </button>
              {keys[ex.id] && (
                <button onClick={() => remove(ex.id)} className="rounded-xl px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                  Удалить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="mt-2 text-xs text-slate-300">{msg}</p>}
    </div>
  )
}
