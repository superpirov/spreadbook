import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Search, ArrowLeftRight, LineChart, TriangleAlert, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/useAuth.js'
import { EXCHANGES, fetchExchange, findTriangles } from '../utils/quotes.js'
import { P2P_EXCHANGES, P2P_FETCHERS, loadExKeys } from '../utils/exkeys.js'

const EX_BADGE = {
  bybit: 'bg-amber-400/15 text-amber-200',
  htx: 'bg-sky-500/15 text-sky-200',
  mexc: 'bg-emerald-500/15 text-emerald-200',
}

const REFRESH_DEFAULT = 20

export default function Quotes() {
  const user = useAuth((s) => s.user)
  const [tab, setTab] = useState('spot') // spot | arb | p2p
  const [exFilter, setExFilter] = useState('all')
  const [q, setQ] = useState('')
  const [tickers, setTickers] = useState([])
  const [status, setStatus] = useState({}) // { bybit: 'ok' | 'ok • прокси' | 'loading' | 'error:…' }
  const [updatedAt, setUpdatedAt] = useState(null)
  const [auto, setAuto] = useState(true)
  const [refreshSec, setRefreshSec] = useState(REFRESH_DEFAULT)
  const [refreshing, setRefreshing] = useState(false)
  const firstLoad = useRef(true)

  // Arbitrage controls
  const [arbEx, setArbEx] = useState('bybit')
  const [minProfit, setMinProfit] = useState('0.3')
  const [fee, setFee] = useState('0.1')
  const [minVolume, setMinVolume] = useState('10000')

  // P2P
  const [p2pCreds, setP2pCreds] = useState({})
  const [p2pEx, setP2pEx] = useState('bybit')
  const [p2pToken, setP2pToken] = useState('USDT')
  const [p2pFiat, setP2pFiat] = useState('RUB')
  const [p2pSide, setP2pSide] = useState('buy') // buy = я покупаю крипту
  const [p2pAds, setP2pAds] = useState([])
  const [p2pOpp, setP2pOpp] = useState([])
  const [p2pLoading, setP2pLoading] = useState(false)
  const [p2pError, setP2pError] = useState('')

  useEffect(() => {
    if (!user) return
    loadExKeys(user.id).then(setP2pCreds).catch(() => {})
  }, [user])

  const sideFor = (ex, mySide) => {
    if (ex === 'bybit') return mySide === 'buy' ? '1' : '0'
    return mySide === 'buy' ? 'SELL' : 'BUY'
  }

  const loadP2P = async () => {
    const creds = p2pCreds[p2pEx]
    if (!creds) {
      setP2pError('Сначала добавьте ключ биржи в разделе Бэкап → Биржевые API-ключи.')
      return
    }
    setP2pLoading(true)
    setP2pError('')
    try {
      const fn = P2P_FETCHERS[p2pEx]
      const [mine, opp] = await Promise.all([
        fn(creds, { token: p2pToken, coin: p2pToken, base: p2pToken, fiat: p2pFiat, side: sideFor(p2pEx, p2pSide) }),
        fn(creds, { token: p2pToken, coin: p2pToken, base: p2pToken, fiat: p2pFiat, side: sideFor(p2pEx, p2pSide === 'buy' ? 'sell' : 'buy') }).catch(() => []),
      ])
      setP2pAds(mine)
      setP2pOpp(opp)
    } catch (e) {
      setP2pError(e.message)
      setP2pAds([])
      setP2pOpp([])
    } finally {
      setP2pLoading(false)
    }
  }

  const p2pSpread = useMemo(() => {
    if (p2pAds.length === 0 || p2pOpp.length === 0) return null
    const buyPrice = p2pSide === 'buy'
      ? Math.min(...p2pAds.map((a) => a.price).filter((p) => p > 0))
      : Math.min(...p2pOpp.map((a) => a.price).filter((p) => p > 0))
    const sellPrice = p2pSide === 'buy'
      ? Math.max(...p2pOpp.map((a) => a.price).filter((p) => p > 0))
      : Math.max(...p2pAds.map((a) => a.price).filter((p) => p > 0))
    if (!(buyPrice > 0) || !(sellPrice > 0)) return null
    return { buyPrice, sellPrice, pct: Math.round(((sellPrice - buyPrice) / buyPrice) * 10000) / 100 }
  }, [p2pAds, p2pOpp, p2pSide])

  const load = useCallback(async () => {
    // Don't blank the badges on background refreshes — keep last known state.
    const quiet = !firstLoad.current
    if (!quiet) setStatus({ bybit: 'loading', htx: 'loading', mexc: 'loading' })
    setRefreshing(true)
    const results = await Promise.allSettled(EXCHANGES.map((e) => fetchExchange(e.id)))
    const all = []
    const st = {}
    results.forEach((r, i) => {
      const id = EXCHANGES[i].id
      if (r.status === 'fulfilled') {
        st[id] = r.value.transport === 'ws' ? 'ok • ws-live' : r.value.viaProxy ? 'ok • прокси' : 'ok'
        all.push(...r.value.tickers)
      } else {
        st[id] = `error: ${r.reason?.message || 'нет данных'}`
      }
    })
    setTickers(all)
    setStatus(st)
    setUpdatedAt(new Date())
    setRefreshing(false)
    firstLoad.current = false
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(load, Math.max(5, refreshSec) * 1000)
    return () => clearInterval(id)
  }, [auto, load, refreshSec])

  const spotRows = useMemo(() => {
    const needle = q.trim().toUpperCase()
    return tickers
      .filter((t) => (exFilter === 'all' ? true : t.exchange === exFilter))
      .filter((t) => (needle ? t.symbol.includes(needle) : true))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 200)
  }, [tickers, exFilter, q])

  const arbResults = useMemo(() => {
    const scoped = tickers.filter((t) => t.exchange === arbEx)
    if (scoped.length === 0) return []
    return findTriangles(scoped, {
      base: 'USDT',
      fee: (Number(String(fee).replace(',', '.')) || 0) / 100,
      minProfit: Number(String(minProfit).replace(',', '.')) || 0,
      minVolume: Number(String(minVolume).replace(',', '.')) || 0,
    })
  }, [tickers, arbEx, minProfit, fee, minVolume])

  const exName = (id) => EXCHANGES.find((e) => e.id === id)?.name || id

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Котировки и арбитраж</h1>
          <p className="text-sm text-slate-400">
            Спот трёх бирж без ключей · обновлено {updatedAt ? updatedAt.toLocaleTimeString('ru-RU') : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-indigo-500" />
            авто
          </label>
          <select value={refreshSec} onChange={(e) => setRefreshSec(Number(e.target.value))} className="input w-auto px-2 py-1.5 text-xs" title="Интервал обновления">
            {[5, 10, 20, 30, 60].map((s) => (
              <option key={s} value={s}>{s}с</option>
            ))}
          </select>
          <button onClick={load} className="btn-ghost px-3 py-1.5 text-xs">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Обновить
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {EXCHANGES.map((e) => (
          <span
            key={e.id}
            title={status[e.id]?.startsWith('error') ? status[e.id] : `${e.name}: ${status[e.id] === 'ok • прокси' ? 'OK через прокси (данные могут запаздывать)' : status[e.id] === 'ok • ws-live' ? 'OK через live-поток' : 'OK'}`}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
              String(status[e.id]).startsWith('ok') ? 'bg-emerald-500/10 text-emerald-200' : status[e.id]?.startsWith('error') ? 'bg-red-500/10 text-red-200' : 'bg-white/5 text-slate-400'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${String(status[e.id]).startsWith('ok') ? 'bg-emerald-400' : status[e.id]?.startsWith('error') ? 'bg-red-400' : 'bg-slate-500 animate-pulseSoft'}`} />
            {e.name}{status[e.id] === 'ok • прокси' ? ' · proxy' : status[e.id] === 'ok • ws-live' ? ' · live' : ''}
          </span>
        ))}
      </div>
      {Object.entries(status).some(([, v]) => String(v).startsWith('error')) && (
        <p className="rounded-xl bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
          Часть бирж не отдает данные в браузер (CORS/блокировка): {Object.entries(status).filter(([, v]) => String(v).startsWith('error')).map(([k, v]) => `${exName(k)} (${v})`).join('; ')}. Остальные работают.
        </p>
      )}

      <div className="flex rounded-2xl border border-white/10 bg-ink-900/70 p-1.5 text-sm font-semibold">
        {[
          ['spot', 'Спот-котировки', <LineChart key="s" size={15} />],
          ['arb', 'Арбитраж (внутри биржи)', <ArrowLeftRight key="a" size={15} />],
          ['p2p', 'P2P-стаканы', <KeyRound key="p" size={15} />],
        ].map(([v, label, icon]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 transition ${tab === v ? 'bg-gradient-to-r from-brand to-brand-soft text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'spot' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск пары: BTC, ETH…" className="input pl-9" />
            </div>
            {['all', ...EXCHANGES.map((e) => e.id)].map((id) => (
              <button
                key={id}
                onClick={() => setExFilter(id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${exFilter === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                {id === 'all' ? 'Все' : exName(id)}
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  {['Пара', 'Цена', '24ч, %', 'Объём', 'Биржа'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {spotRows.map((t) => (
                  <tr key={`${t.exchange}-${t.symbol}`} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-2 font-bold">{t.symbol}</td>
                    <td className="px-4 py-2 font-mono">{t.price.toLocaleString('ru-RU', { maximumFractionDigits: 8 })}</td>
                    <td className={`px-4 py-2 font-semibold ${t.changePct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-slate-400">{Math.round(t.volume).toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${EX_BADGE[t.exchange]}`}>{exName(t.exchange)}</span>
                    </td>
                  </tr>
                ))}
                {spotRows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Нет данных. Проверьте статусы бирж выше.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {spotRows.slice(0, 60).map((t) => (
              <div key={`${t.exchange}-${t.symbol}`} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-sm">
                <div>
                  <div className="font-bold">{t.symbol}</div>
                  <div className="text-[11px] text-slate-500">{exName(t.exchange)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{t.price.toLocaleString('ru-RU', { maximumFractionDigits: 8 })}</div>
                  <div className={`text-xs font-bold ${t.changePct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'arb' && (
        <div className="space-y-3">
          <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="label">Биржа</label>
              <select className="input" value={arbEx} onChange={(e) => setArbEx(e.target.value)}>
                {EXCHANGES.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Мин. чистый профит, %</label>
              <input inputMode="decimal" className="input" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} />
            </div>
            <div>
              <label className="label">Комиссия тейкера, %</label>
              <input inputMode="decimal" className="input" value={fee} onChange={(e) => setFee(e.target.value)} />
            </div>
            <div>
              <label className="label">Мин. объём плеча, USDT</label>
              <input inputMode="numeric" className="input" value={minVolume} onChange={(e) => setMinVolume(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button onClick={load} className="btn-primary w-full">
                <RefreshCw size={15} /> Пересканировать
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <h3 className="border-b border-white/10 px-4 py-3 text-sm font-bold">
              Треугольники USDT (чистый % уже с комиссиями): {arbResults.length}
            </h3>
            {arbResults.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-4 py-10 text-center text-sm text-slate-500">
                <TriangleAlert size={16} /> Сейчас цепочек выше порога нет. Снизьте порог или обновите котировки.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {arbResults.map((r, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">{r.path.join(' → ')}</span>
                      <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-200">
                        +{r.netPct}%
                      </span>
                      <span className="text-xs text-slate-500">мин. объём {r.volume.toLocaleString('ru-RU')} USDT</span>
                    </div>
                    <div className="mt-1.5 grid gap-1 text-xs text-slate-400 sm:grid-cols-3">
                      {r.legs.map((l, j) => (
                        <div key={j} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                          <span className={`font-bold ${l.side === 'buy' ? 'text-emerald-300' : 'text-red-300'}`}>
                            {l.side === 'buy' ? 'BUY' : 'SELL'}
                          </span>{' '}
                          <span className="font-mono text-slate-200">{l.pair}</span>{' '}
                          <span className="font-mono">{l.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Расчёт индикативный: по лучшим bid/ask из тикеров, без учёта глубины стакана, проскальзывания и скорости исполнения.
            Реальный треугольник живёт секунды — проверяйте стакан перед сделкой.
          </p>
        </div>
      )}

      {tab === 'p2p' && (
        <div className="space-y-3">
          <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="label">Биржа</label>
              <select className="input" value={p2pEx} onChange={(e) => setP2pEx(e.target.value)}>
                {P2P_EXCHANGES.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}{p2pCreds[e.id] ? '' : ' (нет ключа)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Актив</label>
              <select className="input" value={p2pToken} onChange={(e) => setP2pToken(e.target.value)}>
                {['USDT', 'BTC', 'ETH'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Фиат</label>
              <select className="input" value={p2pFiat} onChange={(e) => setP2pFiat(e.target.value)}>
                {['RUB', 'UAH', 'KZT', 'USD', 'TRY'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Я хочу</label>
              <select className="input" value={p2pSide} onChange={(e) => setP2pSide(e.target.value)}>
                <option value="buy">Купить крипту</option>
                <option value="sell">Продать крипту</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-2">
              <button onClick={loadP2P} disabled={p2pLoading} className="btn-primary w-full">
                <RefreshCw size={15} className={p2pLoading ? 'animate-spin' : ''} /> {p2pLoading ? 'Загрузка…' : 'Загрузить стакан'}
              </button>
            </div>
          </div>

          {!p2pCreds[p2pEx] && (
            <p className="rounded-xl bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
              Для P2P-стакана {P2P_EXCHANGES.find((e) => e.id === p2pEx)?.name} нужен ваш личный ключ.{' '}
              <Link to="/app/settings" className="underline">Добавить в настройках →</Link>
            </p>
          )}
          {p2pError && (
            <p className="rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-200">{p2pError}</p>
          )}
          {p2pSpread && (
            <div className="card flex flex-wrap items-center gap-3 bg-gradient-to-r from-mint/15 to-transparent p-4 text-sm">
              <span>Купить у мерчанта от <b className="font-mono">{p2pSpread.buyPrice.toLocaleString('ru-RU')}</b></span>
              <span>·</span>
              <span>Продать мерчанту до <b className="font-mono">{p2pSpread.sellPrice.toLocaleString('ru-RU')}</b></span>
              <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-200">
                P2P-спред {p2pSpread.pct}%
              </span>
            </div>
          )}

          <div className="card overflow-hidden">
            <h3 className="border-b border-white/10 px-4 py-3 text-sm font-bold">
              Объявления ({p2pSide === 'buy' ? 'продают вам' : 'покупают у вас'}) — {p2pAds.length}
            </h3>
            {p2pAds.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {p2pLoading ? 'Загружаем стакан…' : 'Нажмите «Загрузить стакан».'}
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {p2pAds.map((ad) => (
                  <div key={ad.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{ad.merchant}</span>
                      {ad.tags && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{ad.tags}</span>}
                      {!ad.online && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">офлайн</span>}
                      <span className="ml-auto font-mono text-base font-extrabold">{ad.price.toLocaleString('ru-RU')} {p2pFiat}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                      <span>Мин/макс: {ad.min || '—'} / {ad.max || '—'}</span>
                      {ad.qty > 0 && <span>Доступно: {ad.qty}</span>}
                      {ad.payments && <span>Оплата: {ad.payments}</span>}
                      {(ad.orders !== '—' || ad.rate) && <span>Сделок: {ad.orders}{ad.rate ? ` · ${ad.rate}` : ''}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
