import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Deals from './pages/Deals.jsx'
import Contacts from './pages/Contacts.jsx'
import Settings from './pages/Settings.jsx'

// Public landing + login, cabinet (/app/*) behind auth gate.
function CabinetLayout() {
  return (
    <div className="min-h-screen">
      <Header mode="cabinet" />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 pb-16 pt-6 sm:px-6">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
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
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
