import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, LoaderCircle, MapPin, Search, Sparkles, Users } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { listCampusEvents } from '../api/events';
import { listPublicOrganizations, type ApiOrganization } from '../api/organizations';
import type { ApiCampusEvent } from '../api/types';
import { ApiError } from '../api/client';

function errMsg(error: unknown) { return error instanceof ApiError ? error.message : 'Could not load data.'; }
function shortDate(iso: string) { const d = new Date(iso); return `${d.toLocaleString(undefined, { day: '2-digit' })} ${d.toLocaleString(undefined, { month: 'short' }).toUpperCase()}`; }
function longDate(iso: string) { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' }); }
function timeRange(start: string, end: string) { const s = new Date(start).toLocaleTimeString(undefined, { timeStyle: 'short' }); const e = new Date(end).toLocaleTimeString(undefined, { timeStyle: 'short' }); return `${s} – ${e}`; }
const EVENT_IMAGES = ['/assets/event-innovation.jpg', '/assets/event-culture.jpg', '/assets/event-leadership.jpg'];
function eventImage(id: string) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return EVENT_IMAGES[h % EVENT_IMAGES.length]; }

function EventCard({ event, compact = false }: { event: ApiCampusEvent; compact?: boolean }) {
  return (
    <article className={`event-card${compact ? ' event-card--compact' : ''}`}>
      <Link to={`/events/${event.id}`} className="event-card-image-link" aria-label={`View ${event.title}`}>
        <img className="event-card-image" src={eventImage(event.id)} alt={event.title} loading="lazy" />
        <span className="date-tile"><strong>{shortDate(event.starts_at).split(' ')[0]}</strong><small>{shortDate(event.starts_at).split(' ')[1]}</small></span>
      </Link>
      <div className="event-card-body">
        <div className="event-meta-row"><span className="tag tag--violet">{event.category || 'Campus event'}</span><span className="muted meta-with-icon"><MapPin size={13} />{event.location || 'Campus'}</span></div>
        <h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3>
        {!compact && <p className="event-description">{event.description || 'Campus event details are available on the event page.'}</p>}
        <div className="event-card-footer">
          <span className="muted meta-with-icon"><Users size={14} />{event.confirmed_registrations} registered</span>
          <span className="muted meta-with-icon"><span className="free-dot" />{event.available_capacity} seats left</span>
          <Link className="text-link" to={`/events/${event.id}`}>View details <ArrowRight size={14} /></Link>
        </div>
      </div>
    </article>
  );
}

const HERO_SLIDES = [
  '/assets/hero-campus.jpg',
  '/assets/campus-courtyard.jpg',
  '/assets/campus-halls.jpg',
  '/assets/campus-graduation.jpg',
  '/assets/campus-clubs.jpg',
  '/assets/venue-outdoor.jpg',
  '/assets/venue-seminar.jpg',
  '/assets/campus-admin.jpg',
];

export function HomePage() {
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<ApiCampusEvent[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  useEffect(() => { listCampusEvents().then(setEvents).catch(() => setEvents([])); }, []);
  useEffect(() => {
    // Load additional hero slides after first paint to keep initial load fast.
    const load = () => setHeroReady(true);
    if ('requestIdleCallback' in window) (window as any).requestIdleCallback(load, { timeout: 1500 });
    else setTimeout(load, 600);
  }, []);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || !heroReady || HERO_SLIDES.length < 2) return;
    const id = window.setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 5000);
    return () => window.clearInterval(id);
  }, [heroReady]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/events${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`);
  };

  return (
    <div className="page-wrap home-page">
      <section className="hero-banner" aria-labelledby="home-title">
        <div className="hero-slides" aria-hidden="true">
          {(heroReady ? HERO_SLIDES : HERO_SLIDES.slice(0, 1)).map((src, i) => (
            <div
              key={src}
              className={`hero-slide${i === heroIndex ? ' hero-slide--active' : ''}`}
              style={{ backgroundImage: `linear-gradient(90deg, rgba(10,18,40,.86) 0%, rgba(12,23,48,.62) 40%, rgba(16,29,51,.10) 100%), url("${src}")` }}
            />
          ))}
        </div>
        <div className="hero-content">
          <span className="eyebrow eyebrow--light"><Sparkles size={14} /> CAMPUS LIFE, ALL IN ONE PLACE</span>
          <h1 id="home-title">Your campus.<br />Your events.</h1>
          <p>Discover experiences, find spaces,<br className="desktop-only" /> bring people together.</p>
          <form className="hero-search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="home-search">Search events, venues, or organizations</label>
            <Search size={18} aria-hidden="true" />
            <input id="home-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events, venues, or organizations..." />
            <button className="search-submit" type="submit" aria-label="Search"><Search size={17} /></button>
          </form>
        </div>
        <div className="hero-caption"><span>Find your next campus moment</span><span className="hero-caption-dot" /></div>
      </section>

      <section className="quick-actions" aria-label="Explore UniSpot">
        <Link to="/events" className="quick-action-card">
          <span className="quick-action-icon quick-action-icon--blue"><CalendarDays size={20} /></span>
          <span><strong>Explore Events</strong><small>Find upcoming events and activities.</small></span>
          <ArrowRight className="quick-action-arrow" size={17} />
        </Link>
        <Link to={isAuthenticated ? '/booking/new' : '/signup'} state={isAuthenticated ? undefined : { from: '/booking/new', authRequired: true }} className="quick-action-card">
          <span className="quick-action-icon quick-action-icon--purple"><MapPin size={20} /></span>
          <span><strong>Book a Venue</strong><small>Reserve halls, rooms, and campus spaces.</small></span>
          <ArrowRight className="quick-action-arrow" size={17} />
        </Link>
        <Link to={isAuthenticated ? '/organizer/dashboard' : '/signup'} state={isAuthenticated ? undefined : { from: '/organizer/dashboard', authRequired: true }} className="quick-action-card">
          <span className="quick-action-icon quick-action-icon--violet"><Users size={20} /></span>
          <span><strong>For Organizations</strong><small>Manage your events and registrations.</small></span>
          <ArrowRight className="quick-action-arrow" size={17} />
        </Link>
      </section>

      <section className="section-block" aria-labelledby="featured-title">
        <div className="section-heading">
          <div><span className="eyebrow">MADE FOR YOUR CAMPUS</span><h2 id="featured-title">Featured events</h2><p>Good things are happening around you.</p></div>
          <Link className="text-link" to="/events">View all events <ArrowRight size={15} /></Link>
        </div>
        <div className="event-grid event-grid--three">{events.slice(0, 3).map((event) => <EventCard key={event.id} event={event} />)}</div>
        {events.length === 0 && <p className="muted">No published events available yet.</p>}
      </section>

      <section className="venue-callout">
        <span className="callout-icon"><CalendarDays size={22} /></span>
        <div><strong>Need a space for your event?</strong><p>Find available halls, classrooms, and meeting spaces.</p></div>
        <Link className="button button--primary" to={isAuthenticated ? '/venues' : '/signup'} state={isAuthenticated ? undefined : { from: '/venues', authRequired: true }}>Find a venue <ArrowRight size={16} /></Link>
      </section>

      <section className="home-service-strip">
        <div><span className="eyebrow">ONE CAMPUS, MORE POSSIBILITIES</span><h2>Make more happen here.</h2></div>
        <p>From RSVP to certificates, UniSpot keeps campus life connected.</p>
        <Link className="text-link" to="/services">Explore campus services <ArrowRight size={15} /></Link>
      </section>
    </div>
  );
}

export function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<ApiCampusEvent[]>([]);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [category, setCategory] = useState('All categories');
  const [location, setLocation] = useState('All locations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setLoading(true); listCampusEvents().then(setEvents).catch((e) => setError(errMsg(e))).finally(() => setLoading(false)); }, []);

  const categories = useMemo(() => ['All categories', ...Array.from(new Set(events.map((e) => e.category).filter(Boolean) as string[])).sort()], [events]);
  const locations = useMemo(() => ['All locations', ...Array.from(new Set(events.map((e) => e.location).filter(Boolean) as string[])).sort()], [events]);
  const filteredEvents = useMemo(() => events.filter((event) => {
    const q = search.toLowerCase();
    const matchesSearch = `${event.title} ${event.category ?? ''} ${event.organizer ?? ''} ${event.location ?? ''}`.toLowerCase().includes(q);
    const matchesCategory = category === 'All categories' || event.category === category;
    const matchesLocation = location === 'All locations' || event.location === location;
    return matchesSearch && matchesCategory && matchesLocation;
  }), [search, category, location, events]);

  const clearFilters = () => { setSearch(''); setCategory('All categories'); setLocation('All locations'); setSearchParams({}); };

  return (
    <div className="page-wrap listing-page">
      <div className="page-heading page-heading--split">
        <div><span className="eyebrow">CAMPUS CALENDAR</span><h1>Discover campus events</h1><p>Find events happening around your campus.</p></div>
        <div className="heading-note"><CalendarDays size={18} /><span>Published<br /><strong>events</strong></span></div>
      </div>
      <div className="listing-layout">
        <aside className="filter-panel" aria-label="Event filters">
          <div className="filter-panel-head"><strong>Filters</strong><button type="button" className="text-button" onClick={clearFilters}>Clear all</button></div>
          <div className="filter-group"><label htmlFor="event-category">Event type</label><select id="event-category" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="filter-group"><label htmlFor="event-location">Location</label><select id="event-location" value={location} onChange={(e) => setLocation(e.target.value)}>{locations.map((l) => <option key={l}>{l}</option>)}</select></div>
          <div className="filter-hint"><Sparkles size={16} /><span>Events are loaded from UniSpot.</span></div>
        </aside>
        <section className="results-panel" aria-labelledby="events-results-title">
          <div className="results-toolbar">
            <label className="listing-search"><Search size={17} /><span className="sr-only">Search events</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." /></label>
          </div>
          <div className="results-summary"><h2 id="events-results-title">Upcoming events</h2><span>{loading ? '…' : `${filteredEvents.length} events`}</span></div>
          {loading && <p className="form-status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> Loading events…</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {!loading && <div className="event-list">{filteredEvents.map((event) => <EventCard key={event.id} event={event} compact />)}</div>}
          {!loading && !error && filteredEvents.length === 0 && <div className="empty-state"><Search size={24} /><h3>No events found</h3><p>Try a different search or clear your filters.</p><button className="button button--soft" type="button" onClick={clearFilters}>Clear filters</button></div>}
        </section>
      </div>
    </div>
  );
}

export function EventDetailsPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<ApiCampusEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('About');
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    listCampusEvents().then((items) => setEvent(items.find((item) => item.id === id) ?? null)).catch(() => setEvent(null)).finally(() => setLoading(false));
  }, [id]);

  const copyEventLink = async () => {
    setShareMessage('Copying event link…');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage('Event link copied.');
    } catch {
      setShareMessage('Copy is unavailable in this browser.');
    }
  };
  const shareOnX = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(event?.title ?? 'Campus event')}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener,noreferrer');
  const shareByEmail = () => { window.location.href = `mailto:?subject=${encodeURIComponent(event?.title ?? 'Campus event')}&body=${encodeURIComponent(window.location.href)}`; };
  const goRegister = () => {
    if (!isAuthenticated) { navigate('/signup', { state: { from: `/events/${event?.id ?? ''}`, authRequired: true } }); return; }
    navigate('/services/event-registration-rsvp');
  };

  if (loading) return <div className="page-wrap"><p className="form-status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> Loading event…</p></div>;
  if (!event) return <div className="page-wrap"><div className="empty-state"><h2>Event not found</h2><Link className="button button--primary" to="/events">Browse events</Link></div></div>;

  return (
    <div className="page-wrap detail-page">
      <Link className="back-link" to="/events">← Back to events</Link>
      <div className="event-detail-hero"><img src={eventImage(event.id)} alt={event.title} loading="lazy" decoding="async" /><div className="detail-image-shade" /><span className="detail-category tag tag--white">{event.category || 'Campus event'}</span></div>
      <div className="event-detail-layout">
        <article className="event-detail-main">
          <div className="detail-title-row"><span className="date-tile date-tile--large"><strong>{shortDate(event.starts_at).split(' ')[0]}</strong><small>{shortDate(event.starts_at).split(' ')[1]}</small></span><div><h1>{event.title}</h1><p className="muted">Hosted by <strong>{event.organizer || 'Campus organization'}</strong></p></div></div>
          <div className="event-facts"><span className="meta-with-icon"><CalendarDays size={16} />{longDate(event.starts_at)}</span><span className="meta-with-icon"><Clock3 size={16} />{timeRange(event.starts_at, event.ends_at)}</span><span className="meta-with-icon"><MapPin size={16} />{event.location || 'Campus'}</span><span className="meta-with-icon"><Users size={16} />{event.confirmed_registrations} registered · {event.available_capacity} left</span></div>
          <button className="button button--primary register-button" type="button" onClick={goRegister}>Register Now <ArrowRight size={17} /></button>
          <div className="detail-tabs" role="tablist" aria-label="Event information">{['About', 'Location', 'Organizer', 'Schedule'].map((tab) => <button id={`event-tab-${tab.toLowerCase()}`} aria-controls={`event-panel-${tab.toLowerCase()}`} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'detail-tab detail-tab--active' : 'detail-tab'} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div>
          <div className="tab-content" id="event-panel-about" role="tabpanel" aria-labelledby="event-tab-about" tabIndex={0} hidden={activeTab !== 'About'}><h2>About the event</h2><p>{event.description || 'Details will be shared by the organizer.'}</p><ul className="highlight-list">{[event.category ? `Category: ${event.category}` : null, `Capacity: ${event.capacity}`, `${event.available_capacity} seats remaining`].filter(Boolean).map((item: any) => <li key={String(item)}><span className="highlight-check"><Check size={14} /></span>{item}</li>)}</ul></div>
          <div className="tab-content" id="event-panel-location" role="tabpanel" aria-labelledby="event-tab-location" tabIndex={0} hidden={activeTab !== 'Location'}><h2>{event.location || 'Campus location'}</h2><p>Check campus wayfinding and the venue directory for directions.</p><Link to="/venues" className="text-link">Explore campus venues <ArrowRight size={15} /></Link></div>
          <div className="tab-content" id="event-panel-organizer" role="tabpanel" aria-labelledby="event-tab-organizer" tabIndex={0} hidden={activeTab !== 'Organizer'}><h2>{event.organizer || 'Campus organizer'}</h2><p>Event hosted through UniSpot.</p><Link to="/organizations" className="text-link">View organizations <ArrowRight size={15} /></Link></div>
          <div className="tab-content" id="event-panel-schedule" role="tabpanel" aria-labelledby="event-tab-schedule" tabIndex={0} hidden={activeTab !== 'Schedule'}><h2>Schedule</h2><p>{timeRange(event.starts_at, event.ends_at)}</p><ul className="highlight-list"><li><Clock3 size={15} />Starts: {new Date(event.starts_at).toLocaleString()}</li><li><Clock3 size={15} />Ends: {new Date(event.ends_at).toLocaleString()}</li></ul></div>
        </article>
        <aside className="event-detail-aside"><div className="side-card"><span className="eyebrow">EVENT SNAPSHOT</span><p><strong>{event.confirmed_registrations}</strong><span>registered</span></p><p><strong>{event.available_capacity}</strong><span>seats left</span></p><p><strong>{timeRange(event.starts_at, event.ends_at)}</strong><span>event time</span></p><div className="share-buttons"><span>Share event</span><button type="button" aria-label="Copy event link" onClick={copyEventLink}>↗</button><button type="button" aria-label="Share event on X" onClick={shareOnX}>𝕏</button><button type="button" aria-label="Share event by email" onClick={shareByEmail}>✉</button></div>{shareMessage && <p className="share-status" role="status">{shareMessage}</p>}</div><div className="side-card side-card--soft"><CalendarDays size={20} /><strong>Make it a day to remember.</strong><p>Save your spot and connect with your campus community.</p></div></aside>
      </div>
    </div>
  );
}

export function OrganizationsPage() {
  const { isAuthenticated } = useAuth();
  const [orgs, setOrgs] = useState<ApiOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { listPublicOrganizations().then(setOrgs).catch((e) => setError(errMsg(e))).finally(() => setLoading(false)); }, []);
  return (
    <div className="page-wrap">
      <div className="page-heading"><span className="eyebrow">FIND YOUR PEOPLE</span><h1>Campus organizations</h1><p>Meet the groups making things happen around campus.</p></div>
      {loading && <p className="form-status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> Loading organizations…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && <div className="organization-grid">{orgs.map((organization, index) => <article className="organization-card" key={organization.id}><div className={`organization-art organization-art--${['blue','peach','purple'][index % 3]}`}><span>{String(index + 1).padStart(2, '0')}</span><Users size={34} /></div><span className="eyebrow">{organization.organization_type.replace(/_/g, ' ')}</span><h2>{organization.name}</h2><p>{organization.status === 'ACTIVE' ? 'Active campus organization on UniSpot.' : organization.status}</p><Link className="text-link" to="/events">See upcoming events <ArrowRight size={15} /></Link></article>)}</div>}
      {!loading && !error && orgs.length === 0 && <div className="empty-state"><h3>No organizations available</h3><p>Organizations will appear here once they are added.</p></div>}
      <div className="venue-callout"><span className="callout-icon"><Users size={22} /></span><div><strong>Run a student organization?</strong><p>Bring your events, registrations, and venue bookings together.</p></div><Link className="button button--primary" to={isAuthenticated ? '/organizer/dashboard' : '/signup'} state={isAuthenticated ? undefined : { from: '/organizer/dashboard', authRequired: true }}>Open organizer dashboard <ArrowRight size={16} /></Link></div>
    </div>
  );
}

export function NotFoundPage() {
  return <div className="page-wrap"><div className="empty-state"><span className="eyebrow">404 · NOT FOUND</span><h1>This spot is still open.</h1><p>We couldn’t find the page you were looking for.</p><Link to="/" className="button button--primary">Back to home <ArrowRight size={16} /></Link></div></div>;
}
