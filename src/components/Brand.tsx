import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

type BrandProps = { compact?: boolean };

export function Brand({ compact = false }: BrandProps) {
  return (
    <Link className={`brand${compact ? ' brand--compact' : ''}`} to="/" aria-label="UniSpot home">
      <span className="brand-mark" aria-hidden="true"><CalendarDays size={22} strokeWidth={2.7} /></span>
      <span className="brand-copy">
        <strong>UniSpot</strong>
        {!compact && <small>Discover. Book. Connect.</small>}
      </span>
    </Link>
  );
}
