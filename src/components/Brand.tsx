import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

type BrandProps = { compact?: boolean };

export function Brand({ compact = false }: BrandProps) {
  const { user, isAuthenticated } = useAuth();
  let to = '/';
  if (isAuthenticated && user) {
    if (user.roles?.includes('SYSTEM_ADMIN')) to = '/admin';
    else if (user.roles?.includes('ORGANIZER') || user.roles?.includes('VENUE_ADMIN')) to = '/organizer/dashboard';
    else to = '/student/dashboard';
  }
  return (
    <Link className={`brand${compact ? ' brand--compact' : ''}`} to={to} aria-label="UniSpot home">
      <span className="brand-mark" aria-hidden="true"><CalendarDays size={22} strokeWidth={2.7} /></span>
      <span className="brand-copy">
        <strong>UniSpot</strong>
        {!compact && <small>Discover. Book. Connect.</small>}
      </span>
    </Link>
  );
}
