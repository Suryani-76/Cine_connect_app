import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '../context/AuthContext'
import { ReactNode } from 'react'
import { Film } from 'lucide-react'

interface Props { children: ReactNode; role?: UserRole }

export function ProtectedRoute({ children, role }: Props) {
  const { isAuthenticated, user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-section flex items-center justify-center">
        <div className="text-center">
          <Film size={28} className="text-brand mx-auto mb-3 animate-pulse" />
          <div className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (role && user?.role !== role) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
