import { useState } from 'react';
import { Bell, ChevronDown, Menu, X } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { ChatWidget } from './ChatWidget';
import { useAuth } from '../auth/AuthProvider';

const primaryLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/events', label: 'Events' },
  { to: '/venues', label: 'Venues' },
  { to: '/organizations', label: 'Organizations' },
  { to: '/services', label: 'Services' },
  { to: '/student/dashboard', label: 'My Bookings' },
];

export function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const initials = user?.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

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
              <Link to="/organizer/dashboard" onClick={() => setMenuOpen(false)}>Organizer dashboard</Link>
            </div>
          </nav>
          <div className="topbar-actions">
            {isAuthenticated && <Link className="icon-button notification-button" to="/notifications" aria-label="Notifications"><Bell size={18} /></Link>}
            {user ? <><Link className="topbar-profile" to="/student/dashboard" aria-label="Open your profile and dashboard"><span className="avatar avatar--small" aria-hidden="true">{initials}</span><span className="topbar-profile-name">{user.full_name}</span><ChevronDown size={15} aria-hidden="true" /></Link><button className="text-button" type="button" onClick={logout}>Log out</button></> : <Link className="text-button" to="/login">Log in</Link>}
            <button className="icon-button mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
      </header>
      <main id="main-content" className="main-content"><Outlet /></main>
      <ChatWidget />
    </div>
  );
}
