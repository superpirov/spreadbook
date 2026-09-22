import { Link } from 'react-router-dom'
import {
  Zap,
  BarChart3,
  Users,
  DatabaseBackup,
  ShieldCheck,
  Globe,
  ArrowRight,
  Check,
  ScanSearch,
} from 'lucide-react'
import HeroTicker from '../components/HeroTicker.jsx'

const FEATURES = [
  {
    icon: <Zap size={20} />,
    title: 'Быстрый ввод за секунды',
    text: 'Покупка/продажа, актив, курс, площадка и контрагент — одна форма, автодополнение, мгновенный пересчет итога.',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Живая аналитика',
    text: 'Объем, чистая прибыль, ROI, equity-кривая, разрезы по площадкам и парам. Периоды: день, неделя, месяц, год.',
  },
  {
    icon: <Users size={20} />,
    title: 'CRM контрагентов',
    text: 'Оборот и история по каждому человеку, рейтинг надежности 1–5 звезд и заметки.',
  },
  {
    icon: <DatabaseBackup size={20} />,
    title: 'Бэкап в один клик',
    text: 'Выгрузка всей базы в JSON и CSV для Excel, восстановление из файла при переезде.',
  },
  {
    icon: <ScanSearch size={20} />,
    title: 'AML-скрининг адресов',
    text: 'Проверка кошельков по санкционным спискам OFAC и заморозкам Tether до сделки. История проверок и метки риска у контрагентов.',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Приватность по design’у',
    text: 'Данные — только в вашем личном облаке: чужие пользователи их не видят, а админ видит лишь почту и статус подписки.',
  },
  {
    icon: <Globe size={20} />,
    title: 'Работает везде',
    text: 'Статический сайт: открывается на телефоне и десктопе, ничего устанавливать не нужно.',
  },
]

const STEPS = [
  ['01', 'Войдите по почте', 'Создайте профиль за 10 секунд и получите 3 дня полного доступа.'],
  ['02', 'Записывайте сделки', 'Фиксируйте покупки и продажи прямо с телефона после каждой P2P-операции.'],
  ['03', 'Смотрите прибыль', 'Дашборд покажет спреды, лучший площадки и самых выгодных контрагентов.'],
]

const FAQ = [
  {
    q: 'Мои данные в безопасности?',
    a: 'Да: сделки, контакты и реквизиты лежат в вашем личном облаке и недоступны другим пользователям. Данные синхронизируются между вашими устройствами. Бэкап в JSON всё равно рекомендуем — как страховку.',
  },
  {
    q: 'Это точный бухгалтерский P&L?',
    a: 'Нет, в MVP используется упрощенная cash-flow модель: продажи минус покупки минус комиссии. Переоценка открытых позиций и FIFO/LIFO — в планах.',
  },
  {
    q: 'Нужно ли подключать биржу по API?',
    a: 'Нет. SpreadBook для тех, кто ведет учет вручную и хочет аналитику без API-ключей и лишних рисков.',
  },
  {
    q: 'Что проверяет AML-скрининг?',
    a: 'Адрес сверяется с санкционными списками OFAC (обновляются каждую ночь) и живым статусом заморозки USDT в блокчейне. Проверка занимает секунды, ведётся журнал. Важно: отсутствие совпадений не гарантирует чистоту — это скрининг, а не полный KYT-аудит.',
  },
  {
    q: 'Сколько стоит?',
    a: 'Первые 3 дня — полный доступ без оплаты. Далее PRO: 19 USDT в месяц или 132 USDT в год (выходит 11 USDT в месяц). Оплата в USDT (сеть TRC-20), проверка платежа автоматическая — по хешу транзакции.',
  },
]

export default function Landing() {
  return (
    <div className="space-y-10">
      <HeroTicker />

      {/* Features */}
      <section id="features" className="scroll-mt-24">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-soft">Возможности</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Все для учета спредов — <span className="bg-gradient-to-r from-brand-soft to-mint-soft bg-clip-text text-transparent">без бирж и серверов</span>
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 transition hover:border-white/20">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand/50 to-mint/40 text-white">
                {f.icon}
              </span>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="card bg-gradient-to-br from-brand/15 via-ink-900 to-mint/10 p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Как это работает</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-white/10 bg-ink-950/60 p-5">
              <div className="bg-gradient-to-r from-brand-soft to-mint-soft bg-clip-text text-3xl font-extrabold text-transparent">{n}</div>
              <h3 className="mt-2 font-bold">{t}</h3>
              <p className="mt-1 text-sm text-slate-400">{d}</p>
            </div>
          ))}
        </div>
        <Link to="/login" className="btn-primary mt-6">
          Начать пробный доступ <ArrowRight size={16} />
        </Link>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-soft">Тарифы</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Три дня — бесплатно, дальше — PRO</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          А ещё есть реферальная программа: приводите друзей и получайте +{7} дней PRO за каждого оплатившего — без лимита.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="card p-6">
            <h3 className="font-bold text-mint-soft">Пробный доступ</h3>
            <div className="mt-2 text-3xl font-extrabold">0 USDT <span className="text-sm font-medium text-slate-400">/ 3 дня</span></div>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {['Все возможности без ограничений', 'Без привязки карты', 'Данные остаются вашими'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check size={15} className="text-mint-soft" />{t}</li>
              ))}
            </ul>
            <Link to="/login" className="btn-ghost mt-5 w-full">Попробовать</Link>
          </div>
          <div className="card p-6">
            <h3 className="font-bold text-slate-200">PRO на месяц</h3>
            <div className="mt-2 text-3xl font-extrabold">19 USDT <span className="text-sm font-medium text-slate-400">/ 30 дней</span></div>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {['Всё без ограничений', 'Оплата в USDT, сеть TRC-20', 'Автопроверка платежа по TXID'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check size={15} className="text-mint-soft" />{t}</li>
              ))}
            </ul>
            <Link to="/login" className="btn-ghost mt-5 w-full">Начать с триала</Link>
          </div>
          <div className="card border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-transparent p-6">
            <h3 className="font-bold text-amber-200">PRO на год <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">−42%</span></h3>
            <div className="mt-2 text-3xl font-extrabold">132 USDT <span className="text-sm font-medium text-slate-400">/ год</span></div>
            <div className="text-xs text-slate-400">≈ 11 USDT в месяц вместо 19</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {['Всё без ограничений на 365 дней', 'Оплата в USDT, сеть TRC-20', 'Автопроверка платежа по TXID'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check size={15} className="text-amber-300" />{t}</li>
              ))}
            </ul>
            <Link to="/login" className="btn-primary mt-5 w-full">Начать с триала <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight">Частые вопросы</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="card p-5">
              <h3 className="font-bold">{f.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="card relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-mint/20 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Хватит вести спреды в блокноте</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
            Войдите, добавьте первые сделки и увидите, где реально зарабатываете, а где съедают комиссии.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="btn-primary">
              <Check size={16} /> Попробовать 3 дня бесплатно
            </Link>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-slate-500">
        <span>SpreadBook · учет P2P-сделок · данные в вашем личном облаке</span>
        <Link to="/login" className="hover:text-slate-300">Войти →</Link>
      </footer>
    </div>
  )
}
