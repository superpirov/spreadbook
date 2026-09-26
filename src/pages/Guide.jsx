import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  LayoutDashboard,
  Users,
  ScanSearch,
  Gift,
  Crown,
  DatabaseBackup,
  Target,
  Star,
  Ban,
  FileSpreadsheet,
  Bell,
  Sun,
  Check,
  Send,
  Plus,
} from 'lucide-react'

const MODULES = [
  {
    icon: <LayoutDashboard size={20} />,
    title: 'Дашборд',
    text: 'Сердце кабинета. KPI-карточки (объём, чистая прибыль, ROI), equity-кривая, разрезы по площадкам и парам, тепловой календарь прибыли, цель месяца и сводка по дням с выгрузкой в CSV. Переключайте период: день, неделя, месяц, год.',
    link: '/app',
    linkText: 'Открыть дашборд',
  },
  {
    icon: <ArrowLeftRight size={20} />,
    title: 'Сделки',
    text: 'Быстрый ввод покупки/продажи: актив, фиат, количество, курс, комиссия, площадка, контрагент с автодополнением. Шаблоны частых операций, клонирование одной кнопкой, журнал с поиском и фильтрами, предупреждение о чёрном списке.',
    link: '/app/deals',
    linkText: 'К сделкам',
  },
  {
    icon: <Users size={20} />,
    title: 'Люди',
    text: 'CRM контрагентов: оборот и история по каждому, средний спред (с кем выгоднее работать), рейтинг надёжности, реквизиты (кошельки, карта, телефон, банк), чёрный список. Нового человека можно добавить даже до первой сделки.',
    link: '/app/contacts',
    linkText: 'К людям',
  },
  {
    icon: <ScanSearch size={20} />,
    title: 'AML-проверка',
    text: 'Скрининг кошельков до сделки: санкционные списки OFAC, заморозки Tether, метки Tronscan, жалобы сообщества. Для TRON — риск-анализ с обходом связей до 5 хопов, баллом 0–100 и отчётом. Мониторинг следит за адресами и алертит при изменении статуса.',
    link: '/app/aml',
    linkText: 'Проверить адрес',
  },
  {
    icon: <Gift size={20} />,
    title: 'Рефералы',
    text: 'Ваша ссылка вида SB-XXXXXX. За каждого оплатившего друга — на выбор +7 дней PRO или 25% деньгами (заявка уходит владельцу, выплата вручную). Статусы, кнопки и история — всё на странице.',
    link: '/app/referrals',
    linkText: 'Моя ссылка',
  },
  {
    icon: <DatabaseBackup size={20} />,
    title: 'Бэкап',
    text: 'Полная выгрузка базы в JSON и сделок в CSV для Excel, восстановление из файла. Статус облачной синхронизации: всё, что вводите, само появляется на других устройствах.',
    link: '/app/settings',
    linkText: 'К бэкапу',
  },
]

const STEPS = [
  ['01', 'Запишите первые сделки', 'Раздел «Сделки» → форма за 20 секунд. Или сохраните шаблон типовой операции — дальше будет один клик.'],
  ['02', 'Заполните людей', 'Имена подтянутся сами, добавьте реквизиты, рейтинги и средний спред покажет, с кем выгоднее.'],
  ['03', 'Смотрите аналитику', 'Дашборд посчитает прибыль, ROI и спреды. Поставьте цель месяца и следите за прогрессом.'],
]

const TIPS = [
  { icon: <Target size={15} />, text: 'Поставьте цель месяца — бар прогресса дисциплинирует лучше любых напоминаний.' },
  { icon: <Star size={15} />, text: 'Ставьте звёзды контрагентам сразу после сделки, пока свежи впечатления.' },
  { icon: <Ban size={15} />, text: 'Сомнительный человек — в чёрный список: форма ввода предупредит красным.' },
  { icon: <FileSpreadsheet size={15} />, text: 'Раз в неделю скачивайте JSON-бэкап — страховка на любой случай.' },
  { icon: <Bell size={15} />, text: 'Кошелёк постоянного контрагента — в AML-мониторинг: статус изменится — узнаете первым.' },
  { icon: <Sun size={15} />, text: 'Работаете днём на улице? В шапке есть светлая тема.' },
]

export default function Guide() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-mint/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-soft">Обзор площадки</p>
          <h1 className="mt-1 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl">
            SpreadBook — учёт P2P-сделок, аналитика спредов и AML в{' '}
            <span className="bg-gradient-to-r from-brand-soft to-mint-soft bg-clip-text text-transparent">одном кабинете</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            Вы вручную фиксируете покупки и продажи крипты — сервис превращает записи в живую аналитику:
            где реальная прибыль, какие пары и люди дают спред, а какие кошельки лучше обойти стороной.
            Никаких API-ключей бирж не нужно, данные синхронизируются между вашими устройствами.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/app/deals" className="btn-primary"><Plus size={16} /> Добавить первую сделку</Link>
            <Link to="/app" className="btn-ghost">Смотреть дашборд</Link>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">Как начать за 5 минут</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map(([n, t, d]) => (
            <div key={n} className="card p-5">
              <div className="bg-gradient-to-r from-brand-soft to-mint-soft bg-clip-text text-3xl font-extrabold text-transparent">{n}</div>
              <h3 className="mt-2 font-bold">{t}</h3>
              <p className="mt-1 text-sm text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">Разделы кабинета</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.title} className="card p-5 transition hover:border-white/20">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand/50 to-mint/40 text-white">
                {m.icon}
              </span>
              <h3 className="mt-3 font-bold">{m.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{m.text}</p>
              <Link to={m.link} className="mt-3 inline-block text-sm font-semibold text-brand-soft hover:text-white">
                {m.linkText} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Billing */}
      <section className="card border-amber-400/25 bg-gradient-to-br from-amber-400/10 via-ink-900 to-transparent p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><Crown size={19} className="text-amber-300" /> Как устроена оплата</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {[
            'Первые 3 дня — полный доступ бесплатно, карта не нужна.',
            'Далее PRO: 19 USDT в месяц или 132 USDT в год — оплата в USDT (TRC-20), проверка платежа автоматическая по хешу.',
            'Без PRO кабинет закрывается пейволлом, но ваши данные целы и ждут возвращения.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-amber-300" /> {t}
            </li>
          ))}
        </ul>
        <Link to="/app/billing" className="btn-primary mt-4 w-fit">Тарифы и оплата</Link>
      </section>

      {/* Tips */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">Советы для максимума пользы</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {TIPS.map((t, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-slate-300">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-slate-900 dark:text-white">{t.icon}</span>
              {t.text}
            </div>
          ))}
        </div>
      </section>

      {/* Support */}
      <section className="card flex flex-wrap items-center justify-between gap-3 border-amber-400/20 p-5">
        <div>
          <h2 className="font-extrabold">Остались вопросы?</h2>
          <p className="text-sm text-slate-400">Напишите напрямую — отвечаем живьём, а не ботом.</p>
        </div>
        <a href="https://t.me/ruslanpirov" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-black transition hover:brightness-110">
          <Send size={15} /> Написать в Telegram
        </a>
      </section>
    </div>
  )
}
