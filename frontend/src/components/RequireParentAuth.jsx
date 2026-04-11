import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function RequireParentAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  // Wait for the initial session check before rendering or redirecting
  if (loading) return null

  if (!session) {
    // Pass the attempted URL so Login can redirect back after success
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
