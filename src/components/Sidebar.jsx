import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Users, DatabaseBackup, Plus, Crown, ShieldCheck, ScanSearch, Gift } from 'lucide-react'
import { useAuth } from '../store/useAuth.js'
import { isAdmin } from '../utils/admin.js'

const item = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-gradient-to-r from-brand/30 to-mint/20 text-slate-900 ring-1 ring-white/10 dark:text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
  }`

export default function Sidebar() {
  const user = useAuth((s) => s.user)
  const admin = isAdmin(user)
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
          <NavLink to="/app/aml" className={item}>
            <ScanSearch size={17} /> AML-проверка
          </NavLink>
          <NavLink to="/app/referrals" className={item}>
            <Gift size={17} /> Рефералы
          </NavLink>
          <NavLink to="/app/billing" className={item}>
            <Crown size={17} /> Тариф и оплата
          </NavLink>
          <NavLink to="/app/settings" className={item}>
            <DatabaseBackup size={17} /> Импорт / Экспорт
          </NavLink>
          {admin && (
            <NavLink to="/app/admin" className={item}>
              <ShieldCheck size={17} /> Админка
            </NavLink>
          )}
        </nav>
        <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-xs leading-relaxed text-slate-400">
          Данные синхронизируются между вашими устройствами через облако. Бэкап — в разделе «Импорт / Экспорт».
        </p>
      </div>
    </aside>
  )
}
