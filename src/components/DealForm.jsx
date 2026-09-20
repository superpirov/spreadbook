import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { ASSETS, FIATS, PLATFORMS, toLocalInputValue } from '../utils/formatters.js'
import { dealFiatTotal } from '../utils/calculations.js'

const numRe = /^-?\d*[.,]?\d*$/

export default function DealForm({ initial = null, onDone = null }) {
  const addDeal = useStore((s) => s.addDeal)
  const updateDeal = useStore((s) => s.updateDeal)
  const counterparties = useStore((s) => s.counterparties)()

  const [form, setForm] = useState(() => ({
    datetime: initial?.datetime ? toLocalInputValue(new Date(initial.datetime)) : toLocalInputValue(new Date()),
    type: initial?.type || 'buy',
    asset: initial?.asset || 'USDT',
    customAsset: '',
    fiat: initial?.fiat || 'RUB',
    amount: String(initial?.amount ?? ''),
    price: String(initial?.price ?? ''),
    fee: String(initial?.fee ?? '0'),
    platform: initial?.platform || 'Bybit',
    counterparty: initial?.counterparty || '',
    notes: initial?.notes || '',
  }))
  const [errors, setErrors] = useState({})
  const [useCustomAsset, setUseCustomAsset] = useState(false)

  const suggestions = useMemo(() => {
    const q = form.counterparty.trim().toLowerCase()
    if (!q) return []
    return counterparties.filter((c) => c.toLowerCase().includes(q) && c !== form.counterparty).slice(0, 5)
  }, [form.counterparty, counterparties])

  const set = (k, v) => {
    if (['amount', 'price', 'fee'].includes(k) && v !== '' && !numRe.test(v)) return
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const asset = useCustomAsset ? form.customAsset.trim().toUpperCase() : form.asset
  const qty = parseFloat(String(form.amount).replace(',', '.')) || 0
  const price = parseFloat(String(form.price).replace(',', '.')) || 0
  const fee = parseFloat(String(form.fee).replace(',', '.')) || 0
  const total = qty * price

  const validate = () => {
    const e = {}
    if (!asset) e.asset = 'Укажите актив'
    if (!(qty > 0)) e.amount = 'Количество > 0'
    if (!(price > 0)) e.price = 'Цена > 0'
    if (Number.isNaN(fee) || fee < 0) e.fee = 'Комиссия ≥ 0'
    if (!form.datetime) e.datetime = 'Укажите дату'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = (ev) => {
    ev.preventDefault()
    if (!validate()) return
    const payload = {
      datetime: new Date(form.datetime).toISOString(),
      type: form.type,
      asset,
      fiat: form.fiat,
      amount: qty,
      price,
      fee,
      platform: form.platform,
      counterparty: form.counterparty.trim(),
      notes: form.notes.trim(),
    }
    if (initial?.id) updateDeal(initial.id, payload)
    else addDeal(payload)
    if (onDone) onDone()
    else {
      setForm((f) => ({ ...f, amount: '', price: '', counterparty: '', notes: '' }))
    }
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold">{initial ? 'Редактировать сделку' : 'Быстрый ввод сделки'}</h3>
        <div className="flex rounded-xl bg-ink-950 p-1 text-sm font-semibold">
          {[
            ['buy', 'ПОКУПКА'],
            ['sell', 'ПРОДАЖА'],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => set('type', v)}
              className={`rounded-lg px-4 py-1.5 transition ${
                form.type === v
                  ? v === 'buy'
                    ? 'bg-emerald-500/90 text-white'
                    : 'bg-red-500/90 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Дата и время</label>
          <input type="datetime-local" className={`input ${errors.datetime ? 'input-error' : ''}`} value={form.datetime} onChange={(e) => set('datetime', e.target.value)} />
          {errors.datetime && <p className="mt-1 text-xs text-red-400">{errors.datetime}</p>}
        </div>
        <div>
          <label className="label">Площадка / банк</label>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set('platform', p)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  form.platform === p ? 'bg-brand text-white shadow-glow' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Актив</label>
          {!useCustomAsset ? (
            <select className="input" value={form.asset} onChange={(e) => (e.target.value === '__custom' ? setUseCustomAsset(true) : set('asset', e.target.value))}>
              {ASSETS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
              <option value="__custom">+ Свой тикер…</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input className={`input ${errors.asset ? 'input-error' : ''}`} placeholder="Например DOGE" value={form.customAsset} onChange={(e) => set('customAsset', e.target.value)} />
              <button type="button" className="btn-ghost px-3" onClick={() => setUseCustomAsset(false)}>✕</button>
            </div>
          )}
        </div>
        <div>
          <label className="label">Фиат</label>
          <select className="input" value={form.fiat} onChange={(e) => set('fiat', e.target.value)}>
            {FIATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Количество актива</label>
          <input inputMode="decimal" placeholder="1000" className={`input ${errors.amount ? 'input-error' : ''}`} value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount}</p>}
        </div>
        <div>
          <label className="label">Цена за единицу</label>
          <input inputMode="decimal" placeholder="93.5" className={`input ${errors.price ? 'input-error' : ''}`} value={form.price} onChange={(e) => set('price', e.target.value)} />
          {errors.price && <p className="mt-1 text-xs text-red-400">{errors.price}</p>}
        </div>
        <div>
          <label className="label">Комиссия (фиат)</label>
          <input inputMode="decimal" className={`input ${errors.fee ? 'input-error' : ''}`} value={form.fee} onChange={(e) => set('fee', e.target.value)} />
          {errors.fee && <p className="mt-1 text-xs text-red-400">{errors.fee}</p>}
        </div>
        <div className="relative">
          <label className="label">Контрагент (автодополнение)</label>
          <input
            className="input"
            placeholder="Имя / ник"
            value={form.counterparty}
            onChange={(e) => set('counterparty', e.target.value)}
            list="cp-list"
          />
          <datalist id="cp-list">
            {counterparties.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-card">
              {suggestions.map((s) => (
                <button key={s} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5" onClick={() => set('counterparty', s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <label className="label">Заметки</label>
        <textarea rows={2} className="input resize-none" placeholder="Детали сделки…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" className={form.type === 'buy' ? 'btn-mint' : 'btn-primary'}>
          {initial ? 'Сохранить' : form.type === 'buy' ? 'Записать покупку' : 'Записать продажу'}
        </button>
        <div className="text-sm text-slate-400">
          Итого: <span className="font-bold text-white">{dealFiatTotal({ amount: qty, price }).toLocaleString('ru-RU')} {form.fiat}</span>
          {fee > 0 && <span className="text-slate-500"> + комиссия {fee.toLocaleString('ru-RU')}</span>}
        </div>
      </div>
    </form>
  )
}
