import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, ExternalLink, Trash2, ScanSearch, Database, Copy, Check, Search, Flag } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { useAuth, useCurrentSub } from '../store/useAuth.js'
import { fetchApprovedReports, submitReport } from '../utils/users.js'
import { getAccessState } from '../utils/billing.js'
import {
  AML_SOURCES,
  TRIAL_CHECKS_PER_DAY,
  getCachedLists,
  refreshLists,
  detectNetwork,
  checkAddress,
  checkTetherFrozen,
  checkTronSecurity,
  checkBitcoinAbuse,
  getCanonical,
  getCommunityIndex,
  saveCommunityIndex,
  findRecentCheck,
  explorerUrl,
  checksUsedToday,
} from '../utils/aml.js'
import { analyzeKyt, KYT_LEVEL } from '../utils/kyt.js'
import { formatDateTime } from '../utils/formatters.js'

const NET_NAMES = { tron: 'TRON', evm: 'EVM (ETH/BSC/…)', btc: 'Bitcoin', ltc: 'Litecoin', sol: 'Solana', unknown: 'не распознана' }

export default function Aml() {
  const amlHistory = useStore((s) => s.amlHistory)
  const logAmlCheck = useStore((s) => s.logAmlCheck)
  const clearAmlHistory = useStore((s) => s.clearAmlHistory)
  const sub = useCurrentSub()
  const user = useAuth((s) => s.user)
  const isPro = getAccessState(sub).status === 'pro'

  const [lists, setLists] = useState(() => getCachedLists())
  const [community, setCommunity] = useState(() => getCommunityIndex())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')
  const [addr, setAddr] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null) // { address, network, verdict, matches, frozen, kyt? }
  const [error, setError] = useState('')
  const [mode, setMode] = useState('quick') // quick | deep (KYT-лайт, пока только TRON)
  const [depth, setDepth] = useState(1) // BFS depth for deep mode
  const [deepStage, setDeepStage] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [reason, setReason] = useState('')
  const [reportMsg, setReportMsg] = useState('')
  const [reportBusy, setReportBusy] = useState(false)

  const copyAddr = async (e, h) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(h.address)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = h.address
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopiedId(h.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  useEffect(() => {
    if (!getCachedLists()) {
      setRefreshing(true)
      refreshLists()
        .then((d) => setLists(d))
        .catch((e) => setRefreshMsg(e.message))
        .finally(() => setRefreshing(false))
    }
  }, [])

  const usedToday = checksUsedToday(amlHistory)
  const limitHit = !isPro && usedToday >= TRIAL_CHECKS_PER_DAY

  const doRefresh = async () => {
    setRefreshing(true)
    setRefreshMsg('')
    try {
      const d = await refreshLists()
      setLists(d)
      let commMsg = ''
      try {
        const approved = await fetchApprovedReports()
        const c = saveCommunityIndex(approved)
        setCommunity(c)
        commMsg = ` Сообщество: ${c.total} меток.`
      } catch {
        commMsg = ' Метки сообщества не обновились (нет доступа к облаку).'
      }
      setRefreshMsg(`Базы обновлены: ${d.total.toLocaleString('ru-RU')} адресов.` + (d.errors.length ? ` Не загрузились: ${d.errors.join(', ')} (остались прошлые данные).` : '') + commMsg)
    } catch (e) {
      setRefreshMsg(e.message)
    } finally {
      setRefreshing(false)
    }
  }

  const sendReport = async (e) => {
    e.preventDefault()
    if (!result || reportBusy) return
    setReportBusy(true)
    setReportMsg('')
    try {
      await submitReport({ address: result.address, network: result.network, reason, reporter: user?.email || '' })
      setReportMsg('Жалоба отправлена на модерацию. После одобрения метка появится у всех пользователей.')
      setReason('')
      setShowReport(false)
    } catch (err) {
      setReportMsg(err.message || 'Не удалось отправить жалобу.')
    } finally {
      setReportBusy(false)
    }
  }

  const run = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setShowReport(false)
    setReportMsg('')
    const a = addr.trim()
    if (!a) return
    // Fresh cached verdict — instant, free, no quota spent.
    // Deep mode reuses cache only if the cached report is at least as deep.
    const recent = findRecentCheck(amlHistory, a)
    if (recent && (mode === 'quick' || (recent.kyt && (recent.kyt.depth || 1) >= depth))) {
      setResult({ ...recent, cached: true })
      return
    }
    if (limitHit) {
      setError(`Лимит триала — ${TRIAL_CHECKS_PER_DAY} проверки в день. PRO — безлимит.`)
      return
    }
    let idx = lists
    if (!idx) {
      setChecking(true)
      try {
        idx = await refreshLists()
        setLists(idx)
      } catch (err) {
        setChecking(false)
        setError(err.message)
        return
      }
    }
    setChecking(true)
    setDeepStage('')
    try {
      const base = checkAddress(a, idx.index, community.index)
      // Canonical contracts skip live/security checks — their flags are meaningless.
      const canonical = getCanonical(a)
      const { frozen, error: rpcError } = (!canonical && (base.network === 'evm' || base.network === 'tron'))
        ? await checkTetherFrozen(a)
        : { frozen: null, error: null }
      const { flags: secFlags, error: secError } = (!canonical && base.network === 'tron')
        ? await checkTronSecurity(a)
        : { flags: [], error: null }
      const { count: abuseCount } = (!canonical && base.network === 'btc')
        ? await checkBitcoinAbuse(a)
        : { count: 0 }
      const matches = [...base.matches, ...secFlags]
      if (frozen === true) matches.push({ source: 'TETHER_FROZEN', label: 'Tether freeze (USDT)' })
      if (abuseCount > 0) matches.push({ source: 'BITCOINABUSE', label: `bitcoinabuse: жалоб ${abuseCount}` })
      const verdict = matches.length > 0 ? 'bad' : base.verdict
      const r = { address: base.address, network: base.network, verdict, matches, frozen, rpcError: rpcError || '', secError: secError || '', canonical: canonical || '', cached: false, kyt: null }
      if (mode === 'deep') {
        if (base.network !== 'tron') {
          setError('Глубокая проверка (KYT-лайт) пока работает только для сети TRON. Для этого адреса доступна быстрая проверка.')
        } else {
          setDeepStage('Собираю историю транзакций…')
          try {
            r.kyt = await analyzeKyt(a, idx.index, { verdict, matches, frozen }, {
              depth,
              community: community.index,
              onProgress: ({ stage, done, total }) => setDeepStage(total > 1 ? `${stage} (${done}/${total})` : stage),
            })
            if (r.kyt.score >= 51 && r.verdict === 'clean') r.verdict = 'bad'
          } catch (e) {
            setError('Не удалось собрать ончейн-данные для KYT (Tronscan недоступен). Показан результат быстрой проверки.')
          }
          setDeepStage('')
        }
      }
      setResult(r)
      await logAmlCheck({ address: r.address, network: r.network, verdict: r.verdict, matches, frozen, depth: mode === 'deep' ? depth : 0, counterparty: '', kyt: r.kyt })
    } finally {
      setChecking(false)
      setDeepStage('')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">AML-проверка</h1>
        <p className="text-sm text-slate-400">Скрининг адресов по санкционным спискам OFAC и заморозкам Tether — до сделки, а не после.</p>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Database size={15} /> Базы скрининга</h3>
          <button onClick={doRefresh} disabled={refreshing} className="btn-ghost px-3 py-1.5 text-xs">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Загрузка…' : 'Обновить базы'}
          </button>
        </div>
        {lists ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-lg bg-emerald-500/15 px-2 py-1 font-semibold text-emerald-200">
              {lists.total.toLocaleString('ru-RU')} адресов · обновлено {formatDateTime(lists.updatedAt)}
            </span>
            {AML_SOURCES.map((s) => (
              <span key={s.id} className="rounded-lg bg-white/5 px-2 py-1 text-slate-400">
                {s.id}: {(lists.counts[s.id] ?? 0).toLocaleString('ru-RU')}
              </span>
            ))}
            <span className="rounded-lg bg-brand/15 px-2 py-1 text-brand-soft" title="Метки сообщества (модерируются)">
              👥 сообщество: {(community.total ?? 0).toLocaleString('ru-RU')}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Базы ещё не загружены — нажмите «Обновить базы» (нужен интернет, ~40 КБ).</p>
        )}
        {refreshMsg && <p className="mt-2 text-xs text-slate-300">{refreshMsg}</p>}
        <p className="mt-2 text-[11px] text-slate-500">
          Источник: OFAC SDN (репо 0xB10C, автообновление каждую ночь) + живой ончейн-статус заморозки USDT. Лейблы Etherscan/Tronscan («Phishing») закрыты их API — сверяйте вручную по ссылке из результата.
        </p>
      </div>

      <form onSubmit={run} className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold"><ScanSearch size={15} /> Проверить адрес</h3>
          <span className="text-xs text-slate-500">
            {isPro ? 'PRO: безлимит' : `Триал: использовано ${usedToday}/${TRIAL_CHECKS_PER_DAY} сегодня`}
          </span>
        </div>
        <div className="mt-3 flex rounded-xl bg-ink-950 p-1 text-sm font-semibold">
          {[
            ['quick', 'Быстрая проверка'],
            ['deep', 'Глубокая (KYT-лайт · TRON)'],
          ].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setResult(null); setError('') }}
              className={`flex-1 rounded-lg px-3 py-1.5 transition ${mode === m ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'deep' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-wide text-slate-400">Глубина обхода:</span>
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepth(d)}
                className={`rounded-xl px-3 py-1.5 font-bold transition ${depth === d ? 'bg-gradient-to-r from-brand to-brand-soft text-white shadow-glow' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {d} хоп{d === 1 ? '' : 'а'}
              </button>
            ))}
            <span className="text-slate-500">
              {depth === 1 ? 'секунды' : depth === 2 ? 'до ~1 минуты' : depth === 3 ? 'до ~2–3 минут' : 'долго, больше шума'}
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="input font-mono text-xs"
            placeholder="TXXXX… / 0x… / bc1…"
            value={addr}
            onChange={(e) => { setAddr(e.target.value); setError(''); }}
          />
          <button type="submit" disabled={checking || !addr.trim()} className="btn-primary shrink-0">
            <ShieldCheck size={15} /> {checking ? 'Проверяю…' : 'Проверить'}
          </button>
        </div>
        {deepStage && <p className="mt-2 text-xs text-brand-soft">{deepStage}</p>}
        {addr.trim() && (
          <p className="mt-1 text-xs text-slate-500">Сеть: {NET_NAMES[detectNetwork(addr)] || 'не распознана'}</p>
        )}
        {error && (
          <p className="mt-2 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {error} {limitHit && <Link to="/app/billing" className="underline">Оформить PRO →</Link>}
          </p>
        )}
        {result && <VerdictCard r={result} />}
        {result?.kyt && <KytReport address={result.address} kyt={result.kyt} />}
        {result && result.verdict !== 'unknown' && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            {!showReport ? (
              <button onClick={() => setShowReport(true)} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
                <Flag size={13} /> Знаете этот адрес как мошеннический? Пожаловаться
              </button>
            ) : (
              <form onSubmit={sendReport} className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="input"
                  placeholder="Причина: скам, фишинг, взлом…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex shrink-0 gap-2">
                  <button type="submit" disabled={reportBusy || !reason.trim()} className="btn-primary px-3 py-2 text-xs">
                    {reportBusy ? 'Отправка…' : 'Отправить'}
                  </button>
                  <button type="button" onClick={() => setShowReport(false)} className="btn-ghost px-3 py-2 text-xs">✕</button>
                </div>
              </form>
            )}
            {reportMsg && <p className="mt-2 text-xs text-slate-300">{reportMsg}</p>}
          </div>
        )}
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-bold">Журнал проверок ({amlHistory.length})</h3>
          {amlHistory.length > 0 && (
            <button onClick={() => { if (window.confirm('Очистить журнал проверок?')) clearAmlHistory() }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-300">
              <Trash2 size={13} /> Очистить
            </button>
          )}
        </div>
        {amlHistory.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Пока пусто. Проверки записываются сюда автоматически, клик по строке открывает детали.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[150px_130px_120px_110px_1fr_90px] gap-2 border-b border-white/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>Время проверки</span>
                <span>Процент</span>
                <span>Риск</span>
                <span>Сеть</span>
                <span>Адрес депозита</span>
                <span />
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {amlHistory.map((h) => (
                  <HistoryRowDesktop key={h.id} h={h} copied={copiedId === h.id} onCopy={(e) => copyAddr(e, h)} onOpen={() => setResult({ ...h, cached: true })} />
                ))}
              </div>
            </div>
            {/* Mobile cards */}
            <div className="max-h-[380px] space-y-2 overflow-y-auto p-3 md:hidden">
              {amlHistory.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setResult({ ...h, cached: true })}
                  className="w-full rounded-xl border border-white/10 bg-ink-950/60 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <ScoreCell h={h} compact />
                    <RiskBadge h={h} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">{formatDateTime(h.createdAt)}</span>
                    <NetBadge net={h.network} />
                  </div>
                  <code className="mt-1 block truncate font-mono text-xs text-slate-300" title={h.address}>{shortAddr(h.address)}</code>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Дисклеймер: скрининг сверяет адрес с известными санкционными и замороженными списками, но не анализирует историю его транзакций.
        Отсутствие совпадений не гарантирует чистоту адреса. Для глубокого KYT-аудита используйте специализированные сервисы.
      </p>
    </div>
  )
}

export function KytReport({ address, kyt }) {
  const lvl = KYT_LEVEL[kyt.level] || KYT_LEVEL.low
  const ring = lvl.cls === 'red' ? '#f87171' : lvl.cls === 'amber' ? '#fbbf24' : '#34d399'
  const C = 2 * Math.PI * 34
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
          <circle
            cx="44" cy="44" r="34" fill="none" stroke={ring} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C - (C * kyt.score) / 100}
            transform="rotate(-90 44 44)"
          />
          <text x="44" y="50" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800">{kyt.score}</text>
        </svg>
        <div className="min-w-0 flex-1">
          <div className="font-bold">KYT-лайт: {lvl.label} ({kyt.score}/100)</div>
          <code className="block truncate font-mono text-xs text-slate-400" title={address}>{address}</code>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-400 sm:grid-cols-3">
            <span>Возраст: {kyt.stats.ageDays !== null ? `${kyt.stats.ageDays} дн.` : '—'}</span>
            <span>Операций: {kyt.stats.txTotal}</span>
            <span>Контрагентов: {kyt.stats.peers}</span>
            <span>USDT в: {kyt.stats.usdtIn.toLocaleString('ru-RU')}</span>
            <span>USDT из: {kyt.stats.usdtOut.toLocaleString('ru-RU')}</span>
            <span>Активность: {kyt.stats.lifespanH !== null ? `${kyt.stats.lifespanH} ч` : '—'}</span>
            <span>Экспозиция санкций: {kyt.exposurePct ?? 0}% объёма</span>
            <span>Глубина: {kyt.depth || 1} хоп{(kyt.depth || 1) === 1 ? '' : 'а'}</span>
            {kyt.stats.fakeContracts?.length > 0 && <span className="font-bold text-red-300">Поддельный USDT!</span>}
          </div>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-ghost px-3 py-1.5 text-xs">Печать / PDF</button>
      </div>
      {kyt.factors.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {kyt.factors.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
              <span className="shrink-0 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-200">+{f.points}</span>
              <span className="min-w-0 flex-1"><b>{f.label}</b>{f.detail && <span className="text-slate-400"> · {f.detail}</span>}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">Подозрительных факторов не выявлено: возраст, активность и связи в норме.</p>
      )}
      {kyt.dirtyPeers.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-red-300">
            Санкционные связи ({kyt.dirtyPeers.length}) · глубина: {kyt.depth || 1} хоп{(kyt.depth || 1) === 1 ? '' : 'а'}
          </h4>
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((hop) =>
              kyt.dirtyPeers
                .filter((p) => (p.hop || 1) === hop)
                .map((p) => (
                  <div key={p.address} className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-1.5 font-mono text-xs">
                    <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 font-sans text-[10px] font-bold text-red-200">{hop} хоп</span>
                    <span className="min-w-0 flex-1 truncate" title={p.address}>{p.address}</span>
                    <span className="hidden shrink-0 font-sans text-red-200 sm:block">{p.label}</span>
                  </div>
                )),
            )}
          </div>
        </div>
      )}
      {kyt.topPeers.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Топ контрагентов</h4>
          <div className="space-y-1">
            {kyt.topPeers.map((p) => (
              <div key={p.address} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-slate-300">
                <span className="min-w-0 flex-1 truncate" title={p.address}>{p.address}</span>
                <span className="shrink-0">{p.txs} оп.</span>
                {p.canonical && <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 font-sans text-[10px] font-bold text-emerald-200" title={p.canonical}>контракт</span>}
                {p.dirty && <span className="shrink-0 font-bold text-red-300">санкции</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">KYT-лайт: прямые связи (1 хоп) + поведение. Полный графовый анализ — в следующих версиях.</p>
    </div>
  )
}

export function shortAddr(a) {
  const s = String(a || '')
  return s.length > 12 ? `${s.slice(0, 5)}...${s.slice(-5)}` : s
}

function levelOf(h) {
  if (h.kyt) return h.kyt.level
  if (h.verdict === 'bad') return 'high'
  if (h.verdict === 'clean') return 'low'
  return null
}

const LEVEL_STYLE = {
  low: { text: 'Низкий', cls: 'bg-emerald-500/15 text-emerald-200', bar: '#34d399' },
  medium: { text: 'Средний', cls: 'bg-amber-400/15 text-amber-200', bar: '#fbbf24' },
  high: { text: 'Высокий', cls: 'bg-red-500/15 text-red-200', bar: '#f87171' },
}

export function ScoreCell({ h, compact = false }) {
  const score = h.kyt ? h.kyt.score : null
  if (score === null || score === undefined) {
    return <span className="text-xs text-slate-500">— <span className="hidden sm:inline">быстрая</span></span>
  }
  const lvl = levelOf(h)
  const bar = LEVEL_STYLE[lvl]?.bar || '#94a3b8'
  return (
    <span className={compact ? '' : 'block'}>
      <span className="text-sm font-bold text-white">{score}%</span>
      <span className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full rounded-full" style={{ width: `${score}%`, background: bar }} />
      </span>
    </span>
  )
}

export function RiskBadge({ h }) {
  const lvl = levelOf(h)
  if (!lvl) return <span className="text-xs text-slate-500">—</span>
  return (
    <span className={`inline-block rounded-lg px-3 py-1 text-xs font-bold ${LEVEL_STYLE[lvl].cls}`}>
      {LEVEL_STYLE[lvl].text}
    </span>
  )
}

const NET_STYLE = {
  tron: { text: 'TRX', cls: 'bg-[#eb0029]/15 text-[#ff5c7a]' },
  evm: { text: 'EVM', cls: 'bg-brand/20 text-brand-soft' },
  btc: { text: 'BTC', cls: 'bg-amber-500/15 text-amber-300' },
  ltc: { text: 'LTC', cls: 'bg-slate-400/15 text-slate-300' },
  sol: { text: 'SOL', cls: 'bg-violet-500/15 text-violet-300' },
}

export function NetBadge({ net }) {
  const s = NET_STYLE[net] || { text: NET_NAMES[net] || '?', cls: 'bg-white/5 text-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold ${s.cls}`}>
      {net === 'tron' && <span className="grid h-4 w-4 place-items-center rounded-full bg-[#eb0029] text-[9px] font-black text-white">T</span>}
      {s.text}
    </span>
  )
}

function HistoryRowDesktop({ h, copied, onCopy, onOpen }) {
  return (
    <div
      onClick={onOpen}
      title="Открыть подробности проверки"
      className="grid cursor-pointer grid-cols-[150px_130px_120px_110px_1fr_90px] items-center gap-2 border-b border-white/5 px-4 py-2.5 text-sm transition hover:bg-white/[0.04]"
    >
      <span className="text-xs text-slate-300">{formatDateTime(h.createdAt)}</span>
      <ScoreCell h={h} />
      <RiskBadge h={h} />
      <NetBadge net={h.network} />
      <code className="truncate font-mono text-xs text-slate-200" title={h.address}>{shortAddr(h.address)}</code>
      <span className="flex justify-end gap-1">
        <button onClick={onCopy} title="Скопировать адрес" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
          {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
        </button>
        <button onClick={onOpen} title="Открыть подробности" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
          <Search size={14} />
        </button>
      </span>
    </div>
  )
}

export function VerdictDot({ verdict }) {  if (verdict === 'bad') return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400" title="Риск" />
  if (verdict === 'clean') return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" title="Чисто" />
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-500" title="Неизвестно" />
}

export function VerdictCard({ r }) {
  const url = explorerUrl(r.address)
  const freezeUnknown = (r.network === 'evm' || r.network === 'tron') && (r.frozen === null || r.frozen === undefined)
  return (
    <div className={`mt-3 rounded-2xl border p-4 ${
      r.verdict === 'bad' ? 'border-red-500/30 bg-red-500/10' : r.verdict === 'clean' ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'
    }`}>
      <div className="flex items-center gap-2 font-bold">
        {r.verdict === 'bad' ? <ShieldAlert size={18} className="text-red-300" /> : r.verdict === 'clean' ? <ShieldCheck size={18} className="text-emerald-300" /> : <ShieldQuestion size={18} className="text-slate-400" />}
        {r.verdict === 'bad' ? 'Высокий риск — совпадение найдено' : r.verdict === 'clean' ? 'Совпадений в списках OFAC нет' : 'Не удалось проверить'}
      </div>
      <code className="mt-1 block break-all font-mono text-xs text-slate-300">{r.address}</code>
      {r.canonical && (
        <p className="mt-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          ✓ Официальный контракт: {r.canonical} — метки API для него игнорируются.
        </p>
      )}
      {r.matches.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {r.matches.map((m) => (
            <li key={m.source} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-200">
              🚩 {m.label}
            </li>
          ))}
        </ul>
      )}
      {r.verdict !== 'unknown' && (
        <p className="mt-2 text-xs text-slate-400">
          Tether freeze: {r.frozen === true ? <b className="text-red-300">заморожен</b> : r.frozen === false ? <b className="text-emerald-300">не заморожен</b> : 'не проверено (сеть/RPC)'} · Сеть: {NET_NAMES[r.network] || r.network}
        </p>
      )}
      {r.cached && (
        <p className="mt-2 text-xs text-slate-500">Результат из кэша (проверялся ранее, младше 24 ч) — API не опрашивался.</p>
      )}
      {freezeUnknown && r.verdict === 'clean' && (
        <p className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          ⚠ Статус заморозки USDT проверить не удалось (RPC недоступен). Адрес может быть заморожен Tether, хотя в OFAC его нет — сверьте вручную в обозревателе перед сделкой.
          {r.rpcError && <span className="mt-1 block font-mono text-[10px] opacity-70">{r.rpcError}</span>}
        </p>
      )}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          Открыть в обозревателе (сверить лейблы вручную) <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}
