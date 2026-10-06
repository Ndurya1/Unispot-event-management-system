import { useState } from 'react';
import { Bell, ChevronDown, Menu, X } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { ChatWidget } from './ChatWidget';

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

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className={`primary-nav${menuOpen ? ' primary-nav--open' : ''}`} aria-label="Main navigation">
            {primaryLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
                {link.label}
              </NavLink>
            ))}
            <div className="mobile-nav-extra">
              <Link to="/notifications" onClick={() => setMenuOpen(false)}>Notifications</Link>
              <Link to="/organizer/dashboard" onClick={() => setMenuOpen(false)}>Organizer dashboard</Link>
            </div>
          </nav>
          <div className="topbar-actions">
            <Link className="icon-button notification-button" to="/notifications" aria-label="Notifications, 3 unread"><Bell size={18} /><span className="notification-count-badge" aria-hidden="true">3</span></Link>
            <Link className="topbar-profile" to="/student/dashboard" aria-label="Open John Doe’s profile and dashboard">
              <span className="avatar avatar--small" aria-hidden="true">JD</span><span className="topbar-profile-name">John Doe</span><ChevronDown size={15} aria-hidden="true" />
            </Link>
            <button className="icon-button mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main-content" className="main-content"><Outlet /></main>
      <ChatWidget />
    </div>
  );
}
