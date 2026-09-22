import { useEffect, useMemo, useRef, useState } from 'react'

// Animated hero: live ticker tape + SVG equity curve drawing itself.
// Pure frontend eye-candy, no backend needed.
const TICKERS = [
  { s: 'BTC/USDT', p: 67412.5, c: 1.8 },
  { s: 'ETH/USDT', p: 3521.4, c: -0.6 },
  { s: 'SOL/USDT', p: 171.22, c: 3.4 },
  { s: 'TON/USDT', p: 6.84, c: 0.9 },
  { s: 'USDT/RUB', p: 93.42, c: 0.3 },
  { s: 'BTC/RUB', p: 6298400, c: 2.1 },
  { s: 'ETH/RUB', p: 329100, c: -1.2 },
  { s: 'TRX/USDT', p: 0.1214, c: 0.5 },
]

function useLivePrices() {
  const [tick, setTick] = useState(0)
  const [prices, setPrices] = useState(TICKERS)
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
      setPrices((prev) =>
        prev.map((t) => {
          const drift = (Math.random() - 0.5) * 0.004
          const p = t.p * (1 + drift)
          return { ...t, p, c: t.c + drift * 100 }
        }),
      )
    }, 1500)
    return () => clearInterval(id)
  }, [])
  return { prices, tick }
}

export default function HeroTicker() {
  const { prices } = useLivePrices()
  const row = useMemo(() => [...prices, ...prices], [prices])
  const pathRef = useRef(null)

  useEffect(() => {
    const el = pathRef.current
    if (!el) return
    const len = el.getTotalLength()
    el.style.strokeDasharray = String(len)
    el.style.strokeDashoffset = String(len)
    el.getBoundingClientRect()
    el.style.transition = 'stroke-dashoffset 2.4s ease'
    el.style.strokeDashoffset = '0'
  }, [])

  return (
    <section className="card relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-mint/20 blur-3xl" />
      <div className="relative grid items-center gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 animate-pulseSoft rounded-full bg-emerald-400" />
            P2P-учет в личном облаке · синхронизация · приватно
          </p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            SpreadBook — журнал
            <br />
            <span className="bg-gradient-to-r from-brand-soft via-violet-300 to-mint-soft bg-clip-text text-transparent">
              P2P-сделок и спредов
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            Быстрый ввод покупок и продаж, живой дашборд прибыли, CRM контрагентов и бэкап в JSON/CSV.
            Данные хранятся в вашем личном облаке и доступны с любого устройства.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="#/login" className="btn-primary">
              Войти и начать
            </a>
            <a href="#features" className="btn-ghost">
              Что умеет SpreadBook
            </a>
          </div>
          <div className="mt-5 grid max-w-md grid-cols-3 gap-3 text-center">
            {[
              ['100%', 'локально'],
              ['0 ₽', 'серверов'],
              ['FIFO*', 'скоро'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3">
                <div className="text-base font-bold text-white">{v}</div>
                <div className="text-[11px] text-slate-400">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-ink-950/70 p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>EQUITY · LIVE DEMO</span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-emerald-400" /> +12.4%
              </span>
            </div>
            <svg viewBox="0 0 320 140" className="h-40 w-full">
              <defs>
                <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3131ff" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#3131ff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3131ff" />
                  <stop offset="60%" stopColor="#8b8bff" />
                  <stop offset="100%" stopColor="#518b7b" />
                </linearGradient>
              </defs>
              {[28, 56, 84, 112].map((y) => (
                <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#ffffff" strokeOpacity="0.06" />
              ))}
              <path
                d="M0,118 C30,110 45,96 65,100 C85,104 95,78 120,74 C145,70 155,88 180,80 C205,72 215,44 245,40 C275,36 295,22 320,18 L320,140 L0,140 Z"
                fill="url(#heroArea)"
              />
              <path
                ref={pathRef}
                d="M0,118 C30,110 45,96 65,100 C85,104 95,78 120,74 C145,70 155,88 180,80 C205,72 215,44 245,40 C275,36 295,22 320,18"
                fill="none"
                stroke="url(#heroLine)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="320" cy="18" r="4.5" fill="#518b7b" className="animate-pulseSoft" />
            </svg>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-emerald-400/10 px-2 py-1.5 text-emerald-300">▲ Покупка USDT · 92.50</div>
              <div className="rounded-lg bg-red-400/10 px-2 py-1.5 text-red-300">▼ Продажа USDT · 94.10</div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative mt-6 overflow-hidden rounded-xl border border-white/10 bg-ink-950/60">
        <div className="flex w-max animate-ticker gap-6 whitespace-nowrap px-4 py-2.5 text-xs">
          {row.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-slate-300">
              <span className="font-semibold text-white">{t.s}</span>
              <span>{t.p.toLocaleString('ru-RU', { maximumFractionDigits: 4 })}</span>
              <span className={t.c >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                {t.c >= 0 ? '▲' : '▼'} {Math.abs(t.c).toFixed(2)}%
              </span>
              <span className="text-slate-600">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
