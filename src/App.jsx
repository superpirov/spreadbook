import { HashRouter, Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Billing from './components/Billing.jsx'
import { useCurrentSub } from './store/useAuth.js'
import { useStore } from './store/useStore.js'
import { getAccessState } from './utils/billing.js'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Deals from './pages/Deals.jsx'
import Contacts from './pages/Contacts.jsx'
import Settings from './pages/Settings.jsx'
import BillingPage from './pages/BillingPage.jsx'
import Admin from './pages/Admin.jsx'
import Aml from './pages/Aml.jsx'
import Referrals from './pages/Referrals.jsx'

// Public landing + login, cabinet (/app/*) behind auth gate + paywall.
function CabinetLayout() {
  const sub = useCurrentSub()
  const cloudError = useStore((s) => s.cloudError)
  const cloudReady = useStore((s) => s.cloudReady)
  const loc = useLocation()
  const locked = getAccessState(sub).status === 'expired' && !loc.pathname.endsWith('/billing')

  return (
    <div className="min-h-screen">
      <Header mode="cabinet" />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 pb-16 pt-6 sm:px-6">
        <Sidebar />
        <main className="min-w-0 flex-1 space-y-4">
          {cloudError && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
              {cloudError} Проверьте Rules Firestore и интернет, затем обновите страницу.
            </div>
          )}
          {!cloudReady && !cloudError && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-400">
              Подключаемся к облаку…
            </div>
          )}
          {locked ? <Paywall /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}

function Paywall() {
  return (
    <div className="space-y-4">
      <div className="card border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-300">
          <Lock size={22} />
        </span>
        <h1 className="mt-3 text-xl font-extrabold">Пробный доступ закончился</h1>
        <p className="mx-auto mt-1 max-w-lg text-sm text-slate-400">
          Ваши данные на месте и никуда не делись. Чтобы продолжить пользоваться всеми возможностями сервиса,
          оформите PRO-подписку — проверка оплаты автоматическая, по хешу транзакции.
        </p>
        <Link to="/app/billing" className="btn-primary mx-auto mt-4 w-fit">
          Перейти к оплате
        </Link>
      </div>
      <Billing compact />
    </div>
  )
}

function PublicLayout() {
  return (
    <div className="min-h-screen">
      <Header mode="public" />
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <Outlet />
      </div>
    </div>
  )
}

export default function App() {
  return (
    // HashRouter is mandatory for GitHub Pages (no server-side fallback for routes).
    <HashRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
        </Route>
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <CabinetLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="deals" element={<Deals />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="aml" element={<Aml />} />
          <Route path="referrals" element={<Referrals />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
