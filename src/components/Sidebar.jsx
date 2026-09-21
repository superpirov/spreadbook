import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Users, DatabaseBackup, Plus, Crown } from 'lucide-react'

const item = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-gradient-to-r from-brand/30 to-mint/20 text-white ring-1 ring-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
  }`

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="card sticky top-20 p-3">
        <NavLink to="/app/deals" className="btn-primary mb-3 w-full">
          <Plus size={16} /> Быстрый ввод
        </NavLink>
        <nav className="space-y-1">
          <NavLink to="/app" end className={item}>
            <LayoutDashboard size={17} /> Дашборд
          </NavLink>
          <NavLink to="/app/deals" className={item}>
            <ArrowLeftRight size={17} /> Журнал сделок
          </NavLink>
          <NavLink to="/app/contacts" className={item}>
            <Users size={17} /> Контрагенты
          </NavLink>
          <NavLink to="/app/settings" className={item}>
            <DatabaseBackup size={17} /> Импорт / Экспорт
          </NavLink>
          <NavLink to="/app/billing" className={item}>
            <Crown size={17} /> Тариф и оплата
          </NavLink>
        </nav>
        <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-xs leading-relaxed text-slate-400">
          Все данные хранятся локально в браузере. Не забудьте сделать бэкап в разделе «Импорт / Экспорт».
        </p>
      </div>
    </aside>
  )
}
