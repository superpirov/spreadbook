import { NavLink } from 'react-router-dom'
import { CandlestickChart } from 'lucide-react'

const linkCls = ({ isActive }) =>
  `rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
  }`

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-mint shadow-glow">
            <CandlestickChart size={20} className="text-white" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Spread<span className="bg-gradient-to-r from-brand-soft to-mint-soft bg-clip-text text-transparent">Book</span>
          </span>
        </NavLink>
        <nav className="ml-auto flex items-center gap-1">
          <NavLink to="/" className={linkCls}>
            Дашборд
          </NavLink>
          <NavLink to="/deals" className={linkCls}>
            Сделки
          </NavLink>
          <NavLink to="/contacts" className={linkCls}>
            Люди
          </NavLink>
          <NavLink to="/settings" className={linkCls}>
            Бэкап
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
