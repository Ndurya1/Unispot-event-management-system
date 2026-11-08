import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { homeForRoles } from '../components/ProtectedRoute';

export function AccessDeniedPage() {
  const { user } = useAuth();
  const home = homeForRoles(user?.roles || []);
  return (
    <main className="page-wrap" style={{ maxWidth: 720, margin: '3rem auto' }}>
      <h1>Access denied</h1>
      <p>You don’t have permission to view this page with your current account.</p>
      <p className="muted">If you need additional access, contact a UniSpot administrator to assign the appropriate role or organization membership.</p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <Link className="button button--primary" to={home}>Go to my dashboard</Link>
        <Link className="button button--outline" to="/">Back to home</Link>
      </div>
    </main>
  );
}
