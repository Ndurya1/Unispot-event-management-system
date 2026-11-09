import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Bell, BookOpen, Building2, CalendarDays, ChevronDown, Home, MapPin, Menu, Search, UsersRound, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Brand } from './Brand';
import { useAuth } from '../auth/AuthProvider';
import { hasActiveOrganizerMembership, homeForRoles } from './ProtectedRoute';

type ServiceWorkspaceProps = { children: ReactNode };

function initials(name?: string) {
  return (name || 'User').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'U';
}

export function ServiceWorkspace({ children }: ServiceWorkspaceProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles || [];
  const isStudentOnly = (roles.includes('STUDENT') || roles.includes('UNIVERSITY_STAFF')) && !roles.some((r) => ['ORGANIZER', 'VENUE_ADMIN', 'SERVICE_PROVIDER', 'SYSTEM_ADMIN'].includes(r));
  const canAccessServicePlatform = hasActiveOrganizerMembership(user) || roles.some((r) => ['SYSTEM_ADMIN', 'SERVICE_PROVIDER'].includes(r));
  const profileLink = homeForRoles(roles);
  const displayName = user?.full_name || 'UniSpot user';
  const displayRole = roles[0]?.replace(/_/g, ' ') || 'User';
  const avatar = initials(displayName);
  const workspaceLinks = useMemo(() => [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/events', label: 'Events', icon: CalendarDays },
    ...(isStudentOnly ? [] : [{ to: '/venues', label: 'Venues', icon: MapPin }]),
    { to: '/organizations', label: 'Organizations', icon: UsersRound },
    ...(canAccessServicePlatform ? [{ to: '/services', label: 'Services', icon: Building2 }] : []),
    { to: profileLink, label: roles.includes('ORGANIZER') || roles.includes('VENUE_ADMIN') ? 'My Bookings' : 'My Dashboard', icon: BookOpen },
  ], [canAccessServicePlatform, isStudentOnly, profileLink, roles]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(`/events${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    setMenuOpen(false);
  };

  return (
    <div className="service-workspace">
      <a className="skip-link" href="#service-workspace-main">Skip to main content</a>
      <aside className="service-sidebar" aria-label="UniSpot service dashboard">
        <div className="service-sidebar-head">
          <Brand compact />
          <button
            className="service-sidebar-menu-button"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="service-workspace-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
        </div>
        <nav
          className={`service-sidebar-nav${menuOpen ? ' service-sidebar-nav--open' : ''}`}
          id="service-workspace-navigation"
          aria-label="Main navigation"
        >
          {workspaceLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) => `service-sidebar-link${isActive ? ' service-sidebar-link--active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <Link className="service-sidebar-account" to={profileLink} aria-label={`${displayName}, ${displayRole} account`}>
          <span className="service-avatar" aria-hidden="true">{avatar}</span>
          <span className="service-account-copy"><strong>{displayName}</strong><small>{displayRole}</small></span>
          <ChevronDown size={14} aria-hidden="true" />
        </Link>
      </aside>

      <div className="service-workspace-main">
        <header className="service-workspace-topbar">
          <form className="service-workspace-search" role="search" onSubmit={submitSearch}>
            <Search size={16} aria-hidden="true" />
            <label className="sr-only" htmlFor="service-workspace-search-input">Search events</label>
            <input
              id="service-workspace-search-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events, venues, or organizations..."
            />
            <button type="submit" aria-label="Search UniSpot"><Search size={15} aria-hidden="true" /></button>
          </form>
          <div className="service-workspace-actions">
            <Link className="service-notification-button" to="/notifications" aria-label="Notifications">
              <Bell size={19} aria-hidden="true" />
            </Link>
            <Link className="service-topbar-profile" to={profileLink} aria-label={`${displayName} profile`}>
              <span className="service-avatar" aria-hidden="true">{avatar}</span>
              <span>{displayName}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <main className="service-workspace-content" id="service-workspace-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
