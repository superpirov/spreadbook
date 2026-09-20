import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import Home from './pages/Home.jsx'
import Deals from './pages/Deals.jsx'
import Contacts from './pages/Contacts.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    // HashRouter is mandatory for GitHub Pages (no server-side fallback for routes).
    <HashRouter>
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 pb-16 pt-6 sm:px-6">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
