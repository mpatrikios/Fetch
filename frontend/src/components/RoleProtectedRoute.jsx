import { Navigate } from 'react-router-dom';

function RoleProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole) {
    try {
      const userData = JSON.parse(user);
      if (userData?.role !== requiredRole) {
        // Redirect non-MLG recruiters back to appropriate dashboard
        if (userData?.status === 'completed_onboarding') {
          return <Navigate to="/dashboard" replace />;
        } else {
          return <Navigate to="/onboarding" replace />;
        }
      }
    } catch (error) {
      // Invalid user data, redirect to login
      return <Navigate to="/login" replace />;
    }
  }
  
  return children;
}

export default RoleProtectedRoute;