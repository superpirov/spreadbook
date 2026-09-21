import { useMemo, useState } from 'react'
import { Star, User, UserPlus } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { dealFiatTotal, dealNetValue } from '../utils/calculations.js'
import { formatMoney, formatDateTime } from '../utils/formatters.js'

export default function CounterpartyList() {
  const deals = useStore((s) => s.deals)
  const ratings = useStore((s) => s.ratings)
  const knownCounterparties = useStore((s) => s.knownCounterparties)
  const setRating = useStore((s) => s.setRating)
  const addCounterparty = useStore((s) => s.addCounterparty)
  const [selected, setSelected] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')

  const submitNew = (e) => {
    e.preventDefault()
    const ok = addCounterparty(newName)
    if (!ok) {
      setAddError('Введите уникальное имя (такой контрагент уже есть)')
      return
    }
    const clean = newName.trim()
    setNewName('')
    setAddError('')
    setSelected(clean)
    setNoteDraft(ratings[clean]?.note || '')
  }

  const stats = useMemo(() => {
    const map = new Map()
    const touch = (name) => {
      if (!map.has(name)) map.set(name, { name, deals: [], volume: 0, net: 0 })
      return map.get(name)
    }
    for (const d of deals) {
      const name = (d.counterparty || '').trim()
      if (!name) continue
      const e = touch(name)
      e.deals.push(d)
      e.volume += dealFiatTotal(d)
      e.net += dealNetValue(d)
    }
    // Include explicitly added counterparties even before their first deal.
    for (const n of knownCounterparties) touch(n)
    return [...map.values()]
      .map((e) => ({ ...e, deals: e.deals.sort((a, b) => new Date(b.datetime) - new Date(a.datetime)) }))
      .sort((a, b) => b.volume - a.volume)
  }, [deals, knownCounterparties])

  const sel = stats.find((s) => s.name === selected)

  return (
    <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="card p-3">
        <h3 className="px-2 pb-2 text-sm font-bold">Люди ({stats.length})</h3>
        <form onSubmit={submitNew} className="mb-2 flex gap-2 px-1">
          <input
            className="input"
            placeholder="+ Новый контрагент…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setAddError('') }}
          />
          <button type="submit" className="btn-primary shrink-0 px-3" title="Добавить контрагента">
            <UserPlus size={16} />
          </button>
        </form>
        {addError && <p className="px-2 pb-1 text-xs text-red-400">{addError}</p>}
        <div className="max-h-[540px] space-y-1.5 overflow-y-auto">
          {stats.map((s) => {
            const r = ratings[s.name]
            return (
              <button
                key={s.name}
                onClick={() => { setSelected(s.name); setNoteDraft(ratings[s.name]?.note || '') }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  selected === s.name ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/5'
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand/60 to-mint/60">
                  <User size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block text-xs text-slate-400">
                    {s.deals.length} сделок · {formatMoney(s.volume)}
                    {r?.rating ? ` · ${'★'.repeat(r.rating)}` : ''}
                  </span>
                </span>
                <span className={`text-xs font-bold ${s.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {s.net >= 0 ? '+' : ''}{formatMoney(s.net)}
                </span>
              </button>
            )
          })}
          {stats.length === 0 && <p className="px-2 py-8 text-center text-sm text-slate-500">Пока пусто — добавьте сделку с контрагентом.</p>}
        </div>
      </div>

      <div className="card p-5">
        {!sel ? (
          <p className="grid h-full min-h-[200px] place-items-center text-sm text-slate-500">Выберите человека слева, чтобы увидеть историю и рейтинг.</p>
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold">{sel.name}</h3>
                <p className="text-xs text-slate-400">
                  Оборот {formatMoney(sel.volume)} · cash-flow {formatMoney(sel.net)} · сделок: {sel.deals.length}
                </p>
              </div>
              <Stars
                value={ratings[sel.name]?.rating || 0}
                onRate={(v) => setRating(sel.name, v, ratings[sel.name]?.note || '')}
              />
            </div>
            <label className="label mt-4">Заметка о контрагенте</label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Надежность, скорость переводов…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <button
                className="btn-ghost shrink-0"
                onClick={() => setRating(sel.name, ratings[sel.name]?.rating || 0, noteDraft)}
              >
                Сохранить
              </button>
            </div>
            <div className="mt-4 max-h-[380px] space-y-2 overflow-y-auto">
              {sel.deals.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                  <span className="text-slate-400">{formatDateTime(d.datetime)}</span>
                  <span className={`font-bold ${d.type === 'buy' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {d.type === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="font-semibold">{d.amount} {d.asset} по {formatMoney(d.price, d.fiat)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stars({ value, onRate }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} onClick={() => onRate(i)} title={`${i} / 5`} className="transition hover:scale-110">
          <Star size={20} className={i <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-600'} />
        </button>
      ))}
    </div>
  )
}
