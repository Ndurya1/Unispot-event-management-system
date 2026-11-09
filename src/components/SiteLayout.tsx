import { useCallback, useEffect, useState } from 'react';
import { Bell, ChevronDown, Menu, X } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { ChatWidget } from './ChatWidget';
import { useAuth } from '../auth/AuthProvider';
import { listMyNotifications } from '../api/notifications';

import { hasActiveOrganizerMembership, homeForRoles } from './ProtectedRoute';

function getPrimaryLinks(roles: string[] = [], canAccessServicePlatform = false) {
  const set = new Set(roles);
  if (set.has('SERVICE_PROVIDER')) {
    return [
      { to: '/provider/dashboard', label: 'Dashboard', end: true },
      { to: '/provider/requests', label: 'My Requests' },
      { to: '/services', label: 'Services' },
      { to: '/notifications', label: 'Notifications' },
    ];
  }
  if (set.has('ORGANIZER') || set.has('VENUE_ADMIN')) {
    return [
      { to: '/', label: 'Home', end: true },
      { to: '/events', label: 'Events' },
      { to: '/venues', label: 'Venues' },
      { to: '/organizations', label: 'Organizations' },
      ...(canAccessServicePlatform ? [{ to: '/services', label: 'Services' }] : []),
      { to: '/organizer/dashboard', label: 'Dashboard' },
    ];
  }
  if (set.has('UNIVERSITY_STAFF')) {
    return [
      { to: '/', label: 'Home', end: true },
      { to: '/events', label: 'Events' },
      { to: '/venues', label: 'Venues' },
      { to: '/organizations', label: 'Organizations' },
      { to: '/student/dashboard', label: 'Dashboard' },
    ];
  }
  // default: STUDENT (no venue booking/services platform in nav)
  return [
    { to: '/', label: 'Home', end: true },
    { to: '/events', label: 'Events' },
    { to: '/organizations', label: 'Organizations' },
    { to: '/student/dashboard', label: 'My Dashboard' },
  ];
}

export function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const initials = user?.full_name?.split(' ').map((part: any) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';
  const roles = user?.roles || [];
  const canAccessServicePlatform = hasActiveOrganizerMembership(user) || roles.includes('SYSTEM_ADMIN') || roles.includes('SERVICE_PROVIDER');
  const primaryLinks = getPrimaryLinks(roles, canAccessServicePlatform);
  const profileLink = homeForRoles(roles);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const notifications = await listMyNotifications({ limit: 100 });
      setUnreadCount(notifications.filter((item) => item.delivery_status !== 'READ' && !item.read_at).length);
    } catch {
      // The notification page owns the visible request error; keep the shell quiet.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshUnreadCount();
    const handleNotificationChange = () => { void refreshUnreadCount(); };
    window.addEventListener('unispot:notifications-changed', handleNotificationChange);
    return () => window.removeEventListener('unispot:notifications-changed', handleNotificationChange);
  }, [refreshUnreadCount]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className={`primary-nav${menuOpen ? ' primary-nav--open' : ''}`} aria-label="Main navigation">
            {primaryLinks.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>{link.label}</NavLink>)}
            <div className="mobile-nav-extra">
              <Link to="/notifications" onClick={() => setMenuOpen(false)}>Notifications</Link>
              {(roles.includes('ORGANIZER') || roles.includes('VENUE_ADMIN')) && <Link to="/organizer/dashboard" onClick={() => setMenuOpen(false)}>Organizer dashboard</Link>}
              {roles.includes('SERVICE_PROVIDER') && <Link to="/provider/dashboard" onClick={() => setMenuOpen(false)}>Provider dashboard</Link>}
            </div>
          </nav>
          <div className="topbar-actions">
            {isAuthenticated && <Link className="icon-button notification-button" to="/notifications" aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}><Bell size={18} />{unreadCount > 0 && <span className="notification-count-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link>}
            {user ? <><Link className="topbar-profile" to={profileLink} aria-label="Open your profile and dashboard"><span className="avatar avatar--small" aria-hidden="true">{initials}</span><span className="topbar-profile-name">{user.full_name}</span><ChevronDown size={15} aria-hidden="true" /></Link><button className="text-button" type="button" onClick={() => { logout(); window.location.href = '/login'; }}>Log out</button></> : <><Link className="button button--outline button--small topbar-auth-btn" to="/login">Log in</Link><Link className="button button--primary button--small topbar-auth-btn" to="/signup">Sign up</Link></>}
            <button className="icon-button mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
      </header>
      <main id="main-content" className="main-content"><Outlet /></main>
      <ChatWidget />
    </div>
  );
}
