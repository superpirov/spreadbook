import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/useAuth.js'

// Gate for cabinet routes. Waits for Firebase to restore the session first
// (otherwise a page reload would flash-redirect a logged-in user to /login).
export default function ProtectedRoute({ children }) {
  const user = useAuth((s) => s.user)
  const authReady = useAuth((s) => s.authReady)
  const loc = useLocation()
  if (!authReady) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">
        Проверяем сессию…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return children
}
