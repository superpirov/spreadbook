import { useMemo, useState } from 'react'
import { Star, User, UserPlus, Trash2, Wallet, CreditCard, Phone, Landmark, ScanSearch, Ban } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { useCurrentSub } from '../store/useAuth.js'
import { getAccessState } from '../utils/billing.js'
import {
  TRIAL_CHECKS_PER_DAY,
  getCachedLists,
  refreshLists,
  extractAddresses,
  checkAddress,
  checkTetherFrozen,
  checkTronSecurity,
  checkTronProfile,
  checkPublicAML,
  getCanonical,
  getCommunityIndex,
  getStaticIndex,
  findRecentCheck,
  checksUsedToday,
} from '../utils/aml.js'
import { VerdictDot } from '../pages/Aml.jsx'
import { dealFiatTotal, dealNetValue, counterpartySpread } from '../utils/calculations.js'
import { formatMoney, formatDateTime } from '../utils/formatters.js'

export default function CounterpartyList() {
  const deals = useStore((s) => s.deals)
  const ratings = useStore((s) => s.ratings)
  const knownCounterparties = useStore((s) => s.knownCounterparties)
  const profiles = useStore((s) => s.profiles)
  const setRating = useStore((s) => s.setRating)
  const setProfile = useStore((s) => s.setProfile)
  const addCounterparty = useStore((s) => s.addCounterparty)
  const deleteCounterparty = useStore((s) => s.deleteCounterparty)
  const blacklist = useStore((s) => s.blacklist)
  const toggleBlacklist = useStore((s) => s.toggleBlacklist)
  const aml = useStore((s) => s.aml)
  const amlHistory = useStore((s) => s.amlHistory)
  const setAmlStatus = useStore((s) => s.setAmlStatus)
  const logAmlCheck = useStore((s) => s.logAmlCheck)
  const sub = useCurrentSub()
  const isPro = getAccessState(sub).status === 'pro'
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState({ note: '', wallets: '', cardNumber: '', phone: '', bank: '' })
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [saved, setSaved] = useState(false)
  const [checkingAml, setCheckingAml] = useState(false)
  const [amlMsg, setAmlMsg] = useState('')
  const [amlResults, setAmlResults] = useState([])

  const select = (name) => {
    setSelected(name)
    setSaved(false)
    setAmlMsg('')
    setAmlResults([])
    setDraft({
      note: ratings[name]?.note || '',
      wallets: profiles[name]?.wallets || '',
      cardNumber: profiles[name]?.cardNumber || '',
      phone: profiles[name]?.phone || '',
      bank: profiles[name]?.bank || '',
    })
  }

  const saveDraft = () => {
    if (!selected) return
    setRating(selected, ratings[selected]?.rating || 0, draft.note)
    const { note, ...prof } = draft
    setProfile(selected, prof)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const remove = () => {
    if (!selected) return
    const n = stats.find((s) => s.name === selected)?.deals.length || 0
    if (!window.confirm(`Удалить контрагента «${selected}»?${n > 0 ? ` У него ${n} сделок — сами сделки останутся, но станут безымянными.` : ''} Рейтинг и реквизиты тоже удалятся.`)) return
    deleteCounterparty(selected)
    setSelected(null)
  }

  const checkWallets = async () => {
    if (!selected || checkingAml) return
    setAmlMsg('')
    setAmlResults([])
    const addrs = extractAddresses(draft.wallets || profiles[selected]?.wallets || '')
    if (addrs.length === 0) {
      setAmlMsg('В поле «Адреса кошельков» нет распознаваемых адресов.')
      return
    }
    if (!isPro && checksUsedToday(amlHistory) + addrs.length > TRIAL_CHECKS_PER_DAY) {
      setAmlMsg(`Нужно проверок: ${addrs.length}, а лимит триала — ${TRIAL_CHECKS_PER_DAY} в день. PRO — безлимит.`)
      return
    }
    setCheckingAml(true)
    try {
      let idx = getCachedLists()
      if (!idx) idx = await refreshLists()
      const comm = getCommunityIndex().index
      const lookup = { ...getStaticIndex().index, ...idx.index }
      const out = []
      for (const a of addrs) {
        // Fresh cached verdict — free, no quota spent.
        const recent = findRecentCheck(amlHistory, a)
        if (recent) {
          out.push({ ...recent })
          continue
        }
        const base = checkAddress(a, lookup, comm)
        const canonical = getCanonical(a)
        const { frozen, error: rpcError } = (!canonical && (base.network === 'evm' || base.network === 'tron'))
          ? await checkTetherFrozen(a)
          : { frozen: null, error: null }
        const { flags: secFlags } = (!canonical && base.network === 'tron')
          ? await checkTronSecurity(a)
          : { flags: [], error: null }
        const { risk: tronRisk } = (!canonical && base.network === 'tron')
          ? await checkTronProfile(a)
          : { risk: false }
        const pam = !canonical ? await checkPublicAML(a) : { score: null, sanctioned: false }
        const matches = [...base.matches, ...secFlags]
        if (frozen === true) matches.push({ source: 'TETHER_FROZEN', label: 'Tether freeze (USDT)' })
        if (tronRisk === true) matches.push({ source: 'TRONSCAN_RISK', label: 'Tronscan: risk-флаг' })
        if (pam.sanctioned) matches.push({ source: 'PUBLICAML_SANCTION', label: `PublicAML: санкции${pam.label ? ` (${pam.label})` : ''}` })
        else if (Number.isFinite(pam.score) && pam.score >= 70) matches.push({ source: 'PUBLICAML_SCORE', label: `PublicAML: скор ${Math.round(pam.score)}` })
        const verdict = matches.length > 0 ? 'bad' : base.verdict
        out.push({ address: a, network: base.network, verdict, matches, rpcError: rpcError || '', canonical: canonical || '' })
        await logAmlCheck({ address: a, network: base.network, verdict, matches, frozen, pam: { score: pam.score ?? null, label: pam.label || '', category: pam.category || '', sanctioned: !!pam.sanctioned, direct: pam.direct ?? null, indirect: pam.indirect ?? null, sources: pam.sources || [] }, counterparty: selected })
      }
      // Keep original address order (cached results were prepended out of order).
      out.sort((x, y) => addrs.indexOf(x.address) - addrs.indexOf(y.address))
      setAmlResults(out)
      await setAmlStatus(selected, out.some((r) => r.verdict === 'bad') ? 'bad' : 'clean')
    } catch (e) {
      setAmlMsg(e.message || 'Не удалось выполнить проверку.')
    } finally {
      setCheckingAml(false)
    }
  }

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
    select(clean)
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
      .map((e) => ({
        ...e,
        deals: e.deals.sort((a, b) => new Date(b.datetime) - new Date(a.datetime)),
        spread: counterpartySpread(e.deals),
      }))
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
                onClick={() => select(s.name)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  selected === s.name ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/5'
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand/60 to-mint/60">
                  <User size={16} />
                </span>
                {/* Always rendered (invisible when unchecked) so names align. */}
                <span className={aml[s.name] ? '' : 'invisible'} title={aml[s.name] ? (aml[s.name].status === 'bad' ? 'AML: риск' : 'AML: чисто') : ''}>
                  <VerdictDot verdict={aml[s.name]?.status || 'clean'} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    {blacklist.includes(s.name) && (
                      <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-px text-[10px] font-bold text-red-300">ЧС</span>
                    )}
                  </span>
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
              <div className="flex items-center gap-2">
                <Stars
                  value={ratings[sel.name]?.rating || 0}
                  onRate={(v) => setRating(sel.name, v, ratings[sel.name]?.note || draft.note)}
                />
                <button
                  className={`rounded-lg p-2 transition ${blacklist.includes(sel.name) ? 'bg-red-500/25 text-red-200' : 'text-slate-500 hover:bg-white/10 hover:text-red-300'}`}
                  title={blacklist.includes(sel.name) ? 'Убрать из чёрного списка' : 'В чёрный список'}
                  onClick={() => toggleBlacklist(sel.name)}
                >
                  <Ban size={17} />
                </button>
                <button
                  className="rounded-lg p-2 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                  title="Удалить контрагента"
                  onClick={remove}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
            {blacklist.includes(sel.name) && (
              <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
                В чёрном списке — сделки с этим человеком подсвечиваются при вводе.
              </p>
            )}
            {sel.spread.avg !== null ? (
              <div className="mt-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
                <span className="text-slate-400">Средний спред: </span>
                <b className={sel.spread.avg >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {sel.spread.avg >= 0 ? '+' : ''}{sel.spread.avg}%
                </b>
                {sel.spread.perAsset.length > 1 && (
                  <span className="text-slate-500">
                    {' '}({sel.spread.perAsset.map((p) => `${p.asset} ${p.spread >= 0 ? '+' : ''}${p.spread}%`).join(' · ')})
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">Спред появится, когда будут и покупки, и продажи.</p>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="mb-3 text-sm font-bold">Реквизиты и заметки</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5"><Wallet size={12} /> Адреса кошельков</label>
                  <textarea
                    rows={2}
                    className="input resize-none font-mono text-xs"
                    placeholder={'USDT TRC-20: TXXXX…\nBTC: bc1q…'}
                    value={draft.wallets}
                    onChange={(e) => setDraft((d) => ({ ...d, wallets: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5"><CreditCard size={12} /> Номер карты</label>
                  <input
                    inputMode="numeric"
                    className="input font-mono text-sm"
                    placeholder="0000 0000 0000 0000"
                    value={draft.cardNumber}
                    onChange={(e) => setDraft((d) => ({ ...d, cardNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5"><Phone size={12} /> Номер телефона</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+7 900 000-00-00"
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5"><Landmark size={12} /> Банк</label>
                  <input
                    className="input"
                    placeholder="Например: Сбер, Т-Банк, ВТБ…"
                    value={draft.bank}
                    onChange={(e) => setDraft((d) => ({ ...d, bank: e.target.value }))}
                    list="bank-list"
                  />
                  <datalist id="bank-list">
                    {['Сбер', 'Т-Банк', 'ВТБ', 'Альфа-Банк', 'Райффайзен', 'Газпромбанк', 'ОТП', 'ПриватБанк', 'Монобанк', 'Kaspi', 'Binance', 'Bybit', 'Наличные'].map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Заметка о контрагенте</label>
                  <input
                    className="input"
                    placeholder="Надежность, скорость переводов…"
                    value={draft.note}
                    onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-primary" onClick={saveDraft}>
                  {saved ? 'Сохранено ✓' : 'Сохранить реквизиты'}
                </button>
                <button className="btn-ghost" onClick={checkWallets} disabled={checkingAml}>
                  <ScanSearch size={15} /> {checkingAml ? 'Проверяю…' : 'Проверить кошельки (AML)'}
                </button>
              </div>
              {amlMsg && <p className="mt-2 text-xs text-red-300">{amlMsg}</p>}
              {amlResults.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {amlResults.map((r) => (
                    <div key={r.address} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${r.verdict === 'bad' ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
                      <VerdictDot verdict={r.verdict} />
                      <code className="min-w-0 flex-1 truncate font-mono" title={r.address}>{r.address}</code>
                      <span className="shrink-0">{r.verdict === 'bad' ? r.matches.map((m) => m.label).join(', ') : 'чисто'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <h4 className="mb-2 mt-4 text-sm font-bold">История сделок ({sel.deals.length})</h4>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {sel.deals.length === 0 && (
                <p className="rounded-xl bg-white/[0.03] px-3 py-4 text-center text-xs text-slate-500">Сделок пока нет.</p>
              )}
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
