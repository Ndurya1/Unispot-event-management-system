import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function AdminPageHeader({ title, description, action, eyebrow = 'UNISPOT ADMIN' }: { title: string; description: string; action?: ReactNode; eyebrow?: string }) {
  return <header className="admin-page-header"><div><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="admin-page-actions">{action}</div>}</header>;
}

export function AdminPanel({ title, children, action, className = '' }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`admin-panel${className ? ` ${className}` : ''}`}><header className="admin-panel-head"><h2>{title}</h2>{action}</header>{children}</section>;
}

export function AdminFeedback({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' }) {
  if (!children) return null;
  return <p className={`admin-feedback admin-feedback--${tone}`} role="status" aria-live="polite">{children}</p>;
}

export function AdminStatus({ children }: { children: ReactNode }) {
  const label = String(children ?? '').toLowerCase();
  const tone = label.includes('active') || label.includes('approved') || label.includes('confirmed') || label.includes('complete') || label.includes('checked in')
    ? 'good'
    : label.includes('pending') || label.includes('waiting') || label.includes('maintenance') || label.includes('progress')
      ? 'pending'
      : label.includes('reject') || label.includes('suspend') || label.includes('unavailable') || label.includes('cancel')
        ? 'alert'
        : 'neutral';
  return <span className={`admin-status admin-status--${tone}`}>{children}</span>;
}

export function AdminMetric({ label, value, trend, icon: Icon, tone }: { label: string; value: string; trend: string; icon: LucideIcon; tone: string }) {
  return <article className={`admin-metric admin-metric--${tone}`}><span className="admin-metric-icon"><Icon size={19} aria-hidden="true" /></span><div className="admin-metric-copy"><span>{label}</span><strong>{value}</strong><small>{trend} <span>this month</span></small></div></article>;
}
