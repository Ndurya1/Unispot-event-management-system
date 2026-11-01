import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

function AuthLoading() {
  return <main className="page-wrap"><p className="form-status" role="status">Checking your session…</p></main>;
}

export function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: string[] }) {
  const { isLoading, user } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.some((role) => user.roles.includes(role))) return <Navigate to="/student/dashboard" replace />;
  return <Outlet />;
}
