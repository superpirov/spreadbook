import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/useAuth.js'

// Gate for cabinet routes. Works with any auth provider (see useAuth.js):
// real Firebase user object will flow through the same `user` field.
export default function ProtectedRoute({ children }) {
  const user = useAuth((s) => s.user)
  const loc = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return children
}
