import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RoleProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show nothing while checking auth state
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Redirect non-MLG recruiters back to appropriate dashboard
    if (user?.status === 'completed_onboarding') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}

export default RoleProtectedRoute;