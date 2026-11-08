import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function homeForRoles(roles: string[] = []) {
  if (roles.includes('SYSTEM_ADMIN')) return '/admin';
  if (roles.includes('SERVICE_PROVIDER')) return '/provider/dashboard';
  if (roles.includes('ORGANIZER') || roles.includes('VENUE_ADMIN')) return '/organizer/dashboard';
  return '/student/dashboard';
}

export function hasActiveOrganizerMembership(user: { organizations?: Array<{ membership_role?: string }> } | null | undefined) {
  return Boolean(user?.organizations?.some((organization) => organization.membership_role === 'ORGANIZER'));
}

import { getAccessToken, getRefreshToken } from '../auth/storage';

function AuthLoading() {
  return <main className="page-wrap"><p className="form-status" role="status">Checking your access…</p></main>;
}

function SessionCheckProblem() {
  const { authCheckError, reloadUser } = useAuth();
  return (
    <main className="page-wrap">
      <p className="form-status" role="alert">Could not confirm your session. Your sign-in was kept; check that the backend is running and try again.</p>
      {authCheckError ? <p className="muted">{authCheckError}</p> : null}
      <p className="muted">If this keeps happening, open browser DevTools Network/Console and check <code>/auth/me</code>, token refresh, and protected calls such as <code>/bookings/me</code> or <code>/events/registrations/me</code>.</p>
      <div className="button-row">
        <button className="button button--primary" type="button" onClick={() => { void reloadUser().catch(() => undefined); }}>Retry session check</button>
      </div>
    </main>
  );
}

function hasStoredSession() {
  return Boolean(getAccessToken() || getRefreshToken());
}

export function RequireAuth({ redirectTo = '/login' }: { redirectTo?: string }) {
  const { isLoading, isAuthenticated, authCheckError } = useAuth();
  const location = useLocation();
  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) {
    if (hasStoredSession() && authCheckError) return <SessionCheckProblem />;
    return <Navigate to={redirectTo} replace state={{ from: `${location.pathname}${location.search}`, authRequired: true }} />;
  }
  return <Outlet />;
}

export function RequireRole({ roles, children }: { roles: string[]; children?: React.ReactNode }) {
  const { isLoading, user, authCheckError } = useAuth();
  const location = useLocation();
  if (isLoading) return <AuthLoading />;
  if (!user) {
    if (hasStoredSession() && authCheckError) return <SessionCheckProblem />;
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}`, authRequired: true }} />;
  }
  if (!roles.some((role) => user.roles.includes(role))) {
    return <Navigate to="/access-denied" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return children ? <>{children}</> : <Outlet />;
}

export function RequireOrganizer({ children }: { children?: React.ReactNode }) {
  const { isLoading, user, authCheckError } = useAuth();
  const location = useLocation();
  if (isLoading) return <AuthLoading />;
  if (!user) {
    if (hasStoredSession() && authCheckError) return <SessionCheckProblem />;
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}`, authRequired: true }} />;
  }
  const canAccessServicePlatform =
    hasActiveOrganizerMembership(user) ||
    user.roles.some((role) => ['SYSTEM_ADMIN', 'SERVICE_PROVIDER'].includes(role));
  if (!canAccessServicePlatform) return <Navigate to="/access-denied" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children ? <>{children}</> : <Outlet />;
}
