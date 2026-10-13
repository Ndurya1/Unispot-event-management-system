import { useState, type FormEvent } from 'react';
import { Bell, CalendarDays, ChevronDown, Menu, Search, ShieldCheck, X } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminNavItems } from '../../data/adminMock';

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim()) navigate(`/admin/search?q=${encodeURIComponent(query.trim())}`);
  };
  return <div className="admin-app">
    <a className="skip-link" href="#admin-main">Skip to admin content</a>
    <aside className={`admin-sidebar${menuOpen ? ' admin-sidebar--open' : ''}`}>
      <div className="admin-sidebar-head"><Link to="/" className="admin-brand" aria-label="UniSpot Admin, return to the student site"><span className="admin-brand-mark"><CalendarDays size={22} aria-hidden="true" /></span><span><strong>UniSpot</strong><small>ADMIN</small></span></Link><button className="admin-mobile-menu" type="button" aria-label={menuOpen ? 'Close admin menu' : 'Open admin menu'} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button></div>
      <nav className="admin-navigation" id="admin-navigation" aria-label="Admin navigation">{adminNavItems.map(({ id, label, icon: Icon }) => <NavLink key={id} to={id === 'dashboard' ? '/admin' : `/admin/${id}`} end={id === 'dashboard'} onClick={() => setMenuOpen(false)} className={({ isActive }) => `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`}><Icon size={16} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
      <div className="admin-sidebar-footer"><div className="admin-sidebar-user"><span className="admin-avatar">AU</span><span><strong>Admin User</strong><small>System Administrator</small></span><ChevronDown size={14} aria-hidden="true" /></div><Link className="admin-return-link" to="/">← Return to UniSpot site</Link></div>
    </aside>
    <div className="admin-shell"><header className="admin-topbar"><form className="admin-search" role="search" onSubmit={submitSearch}><Search size={16} aria-hidden="true" /><label className="sr-only" htmlFor="admin-global-search">Search users, events, and venues</label><input id="admin-global-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, events, venues…" /><button type="submit" aria-label="Search admin records" disabled={!query.trim()}><Search size={15} aria-hidden="true" /></button></form><div className="admin-topbar-actions"><Link to="/admin/notifications" className="admin-notification-link" aria-label="Admin notifications, three sample alerts"><Bell size={19} aria-hidden="true" /><span>3</span></Link><div className="admin-topbar-user"><span className="admin-avatar admin-avatar--small">AU</span><span><strong>Admin User</strong><small>Administrator</small></span><ChevronDown size={14} aria-hidden="true" /></div></div></header>
      <main className="admin-main" id="admin-main" tabIndex={-1}><div className="admin-preview-boundary" role="note"><ShieldCheck size={15} aria-hidden="true" /><span><strong>Admin preview only.</strong> Access control, records, audit logging, and notifications are not connected to a backend.</span></div><Outlet /></main>
    </div>
  </div>;
}
