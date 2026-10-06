import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, MapPin, Search, Sparkles, Users } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { events, type CampusEvent } from '../data/mock';

function EventCard({ event, compact = false }: { event: CampusEvent; compact?: boolean }) {
  return (
    <article className={`event-card${compact ? ' event-card--compact' : ''}`}>
      <Link to={`/events/${event.id}`} className="event-card-image-link" aria-label={`View ${event.title}`}>
        <img className="event-card-image" src={event.image} alt={`${event.title} on campus`} loading="lazy" />
        <span className="date-tile"><strong>{event.dateShort.split(' ')[0]}</strong><small>{event.dateShort.split(' ')[1]}</small></span>
      </Link>
      <div className="event-card-body">
        <div className="event-meta-row"><span className="tag tag--violet">{event.category}</span><span className="muted meta-with-icon"><MapPin size={13} />{event.location}</span></div>
        <h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3>
        {!compact && <p className="event-description">{event.description}</p>}
        <div className="event-card-footer">
          <span className="muted meta-with-icon"><Users size={14} />{event.attendees} attendees</span>
          <span className="muted meta-with-icon"><span className="free-dot" />{event.price}</span>
          <Link className="text-link" to={`/events/${event.id}`}>View details <ArrowRight size={14} /></Link>
        </div>
      </div>
    </article>
  );
}

export function HomePage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/events${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`);
  };

  return (
    <div className="page-wrap home-page">
      <section className="hero-banner" aria-labelledby="home-title">
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
        <Link to="/venues" className="quick-action-card">
          <span className="quick-action-icon quick-action-icon--purple"><MapPin size={20} /></span>
          <span><strong>Book a Venue</strong><small>Reserve halls, rooms, and campus spaces.</small></span>
          <ArrowRight className="quick-action-arrow" size={17} />
        </Link>
        <Link to="/organizer/dashboard" className="quick-action-card">
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
        <div className="event-grid event-grid--three">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>
      </section>

      <section className="venue-callout">
        <span className="callout-icon"><CalendarDays size={22} /></span>
        <div><strong>Need a space for your event?</strong><p>Find available halls, classrooms, and meeting spaces.</p></div>
        <Link className="button button--primary" to="/venues">Find a venue <ArrowRight size={16} /></Link>
      </section>

      <section className="home-service-strip">
        <div><span className="eyebrow">ONE CAMPUS, MORE POSSIBILITIES</span><h2>Make more happen here.</h2></div>
        <p>From your first RSVP to the final certificate, UniSpot keeps campus life connected.</p>
        <Link className="text-link" to="/services">Explore campus services <ArrowRight size={15} /></Link>
      </section>
    </div>
  );
}

export function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [categories, setCategories] = useState<string[]>([]);
  const [location, setLocation] = useState('All locations');
  const [date, setDate] = useState('Any date');
  const [organization, setOrganization] = useState('All organizations');

  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesSearch = `${event.title} ${event.category} ${event.organizer} ${event.location}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categories.length === 0 || categories.includes(event.category);
    const matchesLocation = location === 'All locations' || event.location === location;
    const matchesDate = date === 'Any date' || event.date.includes(date);
    const matchesOrganization = organization === 'All organizations' || event.organizer === organization;
    return matchesSearch && matchesCategory && matchesLocation && matchesDate && matchesOrganization;
  }), [search, categories, location, date, organization]);

  const clearFilters = () => {
    setSearch('');
    setCategories([]);
    setLocation('All locations');
    setDate('Any date');
    setOrganization('All organizations');
    setSearchParams({});
  };

  return (
    <div className="page-wrap listing-page">
      <div className="page-heading page-heading--split">
        <div><span className="eyebrow">CAMPUS CALENDAR</span><h1>Discover campus events</h1><p>Find events happening around your campus.</p></div>
        <div className="heading-note"><CalendarDays size={18} /><span>Spring semester<br /><strong>2026</strong></span></div>
      </div>
      <div className="listing-layout">
        <aside className="filter-panel" aria-label="Event filters">
          <div className="filter-panel-head"><strong>Filters</strong><button type="button" className="text-button" onClick={clearFilters}>Clear all</button></div>
          <fieldset className="filter-group"><legend>Event type</legend>
            {['Workshop', 'Seminar', 'Conference', 'Social', 'Sports', 'Cultural'].map((item) => <label className="check-row" key={item}><input type="checkbox" checked={categories.includes(item)} onChange={() => setCategories((current) => current.includes(item) ? current.filter((selected) => selected !== item) : [...current, item])} />{item}</label>)}
          </fieldset>
          <div className="filter-group"><label htmlFor="event-date">Date</label><select id="event-date" value={date} onChange={(event) => setDate(event.target.value)}><option>Any date</option><option>April 2026</option><option>May 2026</option></select></div>
          <div className="filter-group"><label htmlFor="event-location">Location</label><select id="event-location" value={location} onChange={(event) => setLocation(event.target.value)}><option>All locations</option><option>Main Campus</option><option>Campus Grounds</option><option>Lecture Hall A</option></select></div>
          <div className="filter-group"><label htmlFor="event-organization">Organization</label><select id="event-organization" value={organization} onChange={(event) => setOrganization(event.target.value)}><option>All organizations</option><option>KSU Tech Club</option><option>Culture Collective</option><option>Student Leadership Network</option></select></div>
          <div className="filter-hint"><Sparkles size={16} /><span>New events are added throughout the semester.</span></div>
        </aside>
        <section className="results-panel" aria-labelledby="events-results-title">
          <div className="results-toolbar">
            <label className="listing-search"><Search size={17} /><span className="sr-only">Search events</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events..." /></label>
            <label className="sort-select"><span className="sr-only">Sort events</span><select defaultValue="Newest first"><option>Newest first</option><option>Most popular</option><option>Earliest date</option></select></label>
          </div>
          <div className="results-summary"><h2 id="events-results-title">Upcoming events</h2><span>{filteredEvents.length} events</span></div>
          <div className="event-list">{filteredEvents.map((event) => <EventCard key={event.id} event={event} compact />)}</div>
          {filteredEvents.length === 0 && <div className="empty-state"><Search size={24} /><h3>No events found</h3><p>Try a different search or clear your filters.</p><button className="button button--soft" type="button" onClick={clearFilters}>Clear filters</button></div>}
        </section>
      </div>
    </div>
  );
}

export function EventDetailsPage() {
  const { id } = useParams();
  const event = events.find((item) => item.id === id);
  const [registered, setRegistered] = useState(false);
  const [activeTab, setActiveTab] = useState('About');
  const [shareMessage, setShareMessage] = useState('');

  const copyEventLink = async () => {
    setShareMessage('Copying event link…');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable');
      await Promise.race([
        navigator.clipboard.writeText(window.location.href),
        new Promise<void>((_, reject) => window.setTimeout(() => reject(new Error('Clipboard timed out')), 1200)),
      ]);
      setShareMessage('Event link copied.');
    } catch {
      setShareMessage('Copy is unavailable in this browser.');
    }
  };

  const shareOnX = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(event?.title ?? 'Campus event')}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener,noreferrer');
  const shareByEmail = () => { window.location.href = `mailto:?subject=${encodeURIComponent(event?.title ?? 'Campus event')}&body=${encodeURIComponent(window.location.href)}`; };

  if (!event) return <div className="page-wrap"><div className="empty-state"><h2>Event not found</h2><Link className="button button--primary" to="/events">Browse events</Link></div></div>;

  return (
    <div className="page-wrap detail-page">
      <Link className="back-link" to="/events">← Back to events</Link>
      <div className="event-detail-hero"><img src={event.image} alt={`Students at ${event.title}`} /><div className="detail-image-shade" /><span className="detail-category tag tag--white">{event.category}</span></div>
      <div className="event-detail-layout">
        <article className="event-detail-main">
          <div className="detail-title-row"><span className="date-tile date-tile--large"><strong>{event.dateShort.split(' ')[0]}</strong><small>{event.dateShort.split(' ')[1]}</small></span><div><h1>{event.title}</h1><p className="muted">Hosted by <strong>{event.organizer}</strong></p></div></div>
          <div className="event-facts"><span className="meta-with-icon"><CalendarDays size={16} />{event.date}</span><span className="meta-with-icon"><Clock3 size={16} />{event.time}</span><span className="meta-with-icon"><MapPin size={16} />{event.location}</span><span className="meta-with-icon"><Users size={16} />{event.attendees} attendees</span></div>
          <button className={`button register-button${registered ? ' button--success' : ' button--primary'}`} type="button" onClick={() => setRegistered((value) => !value)}>{registered ? <><Check size={17} /> Registered in this demo</> : <>Register Now <ArrowRight size={17} /></>}</button>
          {registered && <p className="inline-success" role="status">You’re on the demo attendee list. No real registration was submitted.</p>}
          <div className="detail-tabs" role="tablist" aria-label="Event information">{['About', 'Location', 'Organizer', 'Schedule'].map((tab) => <button id={`event-tab-${tab.toLowerCase()}`} aria-controls={`event-panel-${tab.toLowerCase()}`} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'detail-tab detail-tab--active' : 'detail-tab'} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div>
          <div className="tab-content" id="event-panel-about" role="tabpanel" aria-labelledby="event-tab-about" tabIndex={0} hidden={activeTab !== 'About'}><h2>About the event</h2><p>{event.description} Meet new people, share ideas, and take away something you can use in your campus journey.</p><h3>Event highlights</h3><ul className="highlight-list">{event.highlights.map((item) => <li key={item}><span className="highlight-check"><Check size={14} /></span>{item}</li>)}</ul></div>
          <div className="tab-content" id="event-panel-location" role="tabpanel" aria-labelledby="event-tab-location" tabIndex={0} hidden={activeTab !== 'Location'}><h2>{event.location}</h2><p>Find your way to the event with campus signage and the UniSpot venue directory.</p><Link to="/venues" className="text-link">Explore campus venues <ArrowRight size={15} /></Link></div>
          <div className="tab-content" id="event-panel-organizer" role="tabpanel" aria-labelledby="event-tab-organizer" tabIndex={0} hidden={activeTab !== 'Organizer'}><h2>{event.organizer}</h2><p>A student-led campus organization bringing people together through events and shared interests.</p><Link to="/organizations" className="text-link">View organizations <ArrowRight size={15} /></Link></div>
          <div className="tab-content" id="event-panel-schedule" role="tabpanel" aria-labelledby="event-tab-schedule" tabIndex={0} hidden={activeTab !== 'Schedule'}><h2>Schedule</h2><p>{event.time} · Doors open 15 minutes before the event.</p><ul className="highlight-list">{event.highlights.slice(0, 3).map((item) => <li key={item}><Clock3 size={15} />{item}</li>)}</ul></div>
        </article>
        <aside className="event-detail-aside"><div className="side-card"><span className="eyebrow">EVENT SNAPSHOT</span><p><strong>{event.attendees}</strong><span>attendees</span></p><p><strong>{event.price}</strong><span>entry</span></p><p><strong>{event.time}</strong><span>event time</span></p><div className="share-buttons"><span>Share event</span><button type="button" aria-label="Copy event link" onClick={copyEventLink}>↗</button><button type="button" aria-label="Share event on X" onClick={shareOnX}>𝕏</button><button type="button" aria-label="Share event by email" onClick={shareByEmail}>✉</button></div>{shareMessage && <p className="share-status" role="status">{shareMessage}</p>}</div><div className="side-card side-card--soft"><CalendarDays size={20} /><strong>Make it a day to remember.</strong><p>Save your spot and connect with your campus community.</p></div></aside>
      </div>
    </div>
  );
}

const organizations = [
  { name: 'Tech Club', type: 'Innovation & learning', text: 'Building, experimenting, and sharing ideas through workshops and campus events.', color: 'blue' },
  { name: 'Culture Collective', type: 'Arts & community', text: 'Celebrating the stories, traditions, food, and creativity that make campus vibrant.', color: 'peach' },
  { name: 'Student Leadership Network', type: 'Leadership & service', text: 'Growing practical leadership skills through mentorship, service, and connection.', color: 'purple' },
];

export function OrganizationsPage() {
  return (
    <div className="page-wrap">
      <div className="page-heading"><span className="eyebrow">FIND YOUR PEOPLE</span><h1>Campus organizations</h1><p>Meet the groups making things happen around campus.</p></div>
      <div className="organization-grid">{organizations.map((organization, index) => <article className="organization-card" key={organization.name}><div className={`organization-art organization-art--${organization.color}`}><span>0{index + 1}</span><Users size={34} /></div><span className="eyebrow">{organization.type}</span><h2>{organization.name}</h2><p>{organization.text}</p><Link className="text-link" to="/events">See upcoming events <ArrowRight size={15} /></Link></article>)}</div>
      <div className="venue-callout"><span className="callout-icon"><Users size={22} /></span><div><strong>Run a student organization?</strong><p>Bring your events, registrations, and venue bookings together.</p></div><Link className="button button--primary" to="/organizer/dashboard">Open organizer dashboard <ArrowRight size={16} /></Link></div>
    </div>
  );
}

export function NotFoundPage() {
  return <div className="page-wrap"><div className="empty-state"><span className="eyebrow">404 · NOT FOUND</span><h1>This spot is still open.</h1><p>We couldn’t find the page you were looking for.</p><Link to="/" className="button button--primary">Back to home <ArrowRight size={16} /></Link></div></div>;
}
