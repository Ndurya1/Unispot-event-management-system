import { ArrowLeft } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ServicePageHeadingProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export function BackToServices() {
  return <Link className="sd-back-link" to="/services"><ArrowLeft size={15} aria-hidden="true" /> Back to Services</Link>;
}

export function ServicePageHeading({ title, description, eyebrow = 'CAMPUS SERVICES', actions }: ServicePageHeadingProps) {
  return (
    <header className="sd-page-heading">
      <div>
        <span className="sd-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="sd-heading-actions">{actions}</div>}
    </header>
  );
}

type WorkspacePanelProps = { title: string; children: ReactNode; action?: ReactNode; className?: string; titleId?: string };

export function WorkspacePanel({ title, children, action, className = '', titleId }: WorkspacePanelProps) {
  return (
    <section className={`sd-panel${className ? ` ${className}` : ''}`} aria-labelledby={titleId}>
      <div className="sd-panel-header">
        <h2 id={titleId}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DemoMessage({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' }) {
  if (!children) return null;
  return <div className={`sd-message sd-message--${tone}`} role="status" aria-live="polite">{children}</div>;
}

export type ServiceTab = { id: string; label: string };
type ServiceTabsProps = { tabs: ServiceTab[]; active: string; onChange: (id: string) => void; idPrefix: string; label: string };

export function ServiceTabs({ tabs, active, onChange, idPrefix, label }: ServiceTabsProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    document.getElementById(`${idPrefix}-tab-${nextTab.id}`)?.focus();
  };

  return (
    <div className="sd-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          className={active === tab.id ? 'sd-tab sd-tab--active' : 'sd-tab'}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
