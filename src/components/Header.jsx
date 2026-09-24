import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogIn, LogOut } from 'lucide-react'
import { useAuth } from '../store/useAuth.js'
import { isAdmin } from '../utils/admin.js'
import logo from '../assets/logo.png'

function Logo() {
  return <img src={logo} alt="SpreadBook" className="h-9 w-auto" />
}

// mode="public"  -> landing/login header with a Login button.
// mode="cabinet" -> cabinet header with user chip + logout.
export default function Header({ mode = 'public' }) {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const nav = useNavigate()

  if (mode === 'cabinet') {
    return (
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/app"><Logo /></Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            <CabLink to="/app">Дашборд</CabLink>
            <CabLink to="/app/deals">Сделки</CabLink>
            <CabLink to="/app/contacts">Люди</CabLink>
            <CabLink to="/app/aml">AML</CabLink>
            <CabLink to="/app/quotes">Котировки</CabLink>
            <CabLink to="/app/referrals">Рефералы</CabLink>
            <CabLink to="/app/billing">Тариф</CabLink>
            <CabLink to="/app/settings">Бэкап</CabLink>
            {isAdmin(user) && <CabLink to="/app/admin">Админ</CabLink>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-[180px] truncate rounded-xl bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:block" title={user?.email}>
              {user?.name} · {user?.email}
            </span>
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => { logout(); nav('/') }}
              title="Выйти"
            >
              <LogOut size={14} /> Выйти
            </button>
          </div>
        </div>
        {/* Mobile cabinet nav */}
        <nav className="flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
          <CabLink to="/app">Дашборд</CabLink>
          <CabLink to="/app/deals">Сделки</CabLink>
          <CabLink to="/app/contacts">Люди</CabLink>
          <CabLink to="/app/aml">AML</CabLink>
          <CabLink to="/app/quotes">Котировки</CabLink>
          <CabLink to="/app/referrals">Рефералы</CabLink>
          <CabLink to="/app/billing">Тариф</CabLink>
          <CabLink to="/app/settings">Бэкап</CabLink>
          {isAdmin(user) && <CabLink to="/app/admin">Админ</CabLink>}
        </nav>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/"><Logo /></Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <a href="#features" className="rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-200">Возможности</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Link to="/app" className="btn-primary px-4 py-2 text-xs">
              Открыть кабинет
            </Link>
          ) : (
            <Link to="/login" className="btn-primary px-4 py-2 text-xs">
              <LogIn size={14} /> Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

function CabLink({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/app'}
      className={({ isActive }) =>
        `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
