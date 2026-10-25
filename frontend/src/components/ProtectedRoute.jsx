import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../context/useAuth.js'

function ProtectedRoute({ children, allowPasswordChange = false, allowedRoles }) {
  const { user, setupComplete } = useAuth()
  const location = useLocation()

  if (!setupComplete) {
    return <Navigate to="/setup" replace />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
