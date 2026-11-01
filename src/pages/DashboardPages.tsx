import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { events } from '../data/mock';
import { ApiError } from '../api/client';
import { cancelBooking, listMyBookings } from '../api/bookings';
import { listMyNotifications, markNotificationRead } from '../api/notifications';
import type { ApiBooking, ApiNotification, NotificationType } from '../api/types';

type DashboardLink = { to: string; label: string; icon: typeof CalendarDays };

function DashboardSidebar({ organizer = false }: { organizer?: boolean }) {
  const location = useLocation();
  const studentLinks: DashboardLink[] = [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/dashboard#bookings', label: 'My Bookings', icon: CalendarCheck },
    { to: '/student/dashboard#my-events', label: 'My Events', icon: CalendarDays },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/my-waitlists', label: 'My Waitlists', icon: ClipboardList },
    { to: '/student/dashboard#profile', label: 'Profile', icon: UserRound },
    { to: '/student/dashboard#settings', label: 'Settings', icon: Settings },
  ];
  const organizerLinks: DashboardLink[] = [
    { to: '/organizer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/organizer/dashboard#events', label: 'My Events', icon: CalendarDays },
    { to: '/organizer/dashboard#bookings', label: 'Bookings', icon: CalendarCheck },
    { to: '/organizer/dashboard#registrations', label: 'Registrations', icon: Users },
    { to: '/organizer/dashboard#announcements', label: 'Announcements', icon: Megaphone },
    { to: '/organizer/dashboard#settings', label: 'Settings', icon: Settings },
  ];
  const links = organizer ? organizerLinks : studentLinks;

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-user">
        <span className="avatar">{organizer ? 'TC' : 'JD'}</span>
        <div><strong>{organizer ? 'Tech Club' : 'John Doe'}</strong><small>{organizer ? 'Organization' : 'Student'}</small></div>
      </div>
      <nav aria-label={organizer ? 'Organizer dashboard' : 'Student dashboard'} className="dashboard-nav">
        {links.map(({ to, label, icon: Icon }) => {
          const [path, hash] = to.split('#');
          const active = location.pathname === path && (hash ? location.hash === `#${hash}` : !location.hash);
          return (
            <Link
              key={label}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`dashboard-nav-link${active ? ' dashboard-nav-link--active' : ''}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <Link className="dashboard-logout" to="/login"><LogOut size={16} />Log out</Link>
    </aside>
  );
}

function DashboardShell({ organizer = false, children }: { organizer?: boolean; children: ReactNode }) {
  return (
    <div className={`dashboard-layout${organizer ? ' dashboard-layout--organizer' : ''}`}>
      <DashboardSidebar organizer={organizer} />
      <div className="dashboard-content">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof CalendarDays; tone: string }) {
  return (
    <article className="metric-card">
      <span className={`metric-icon metric-icon--${tone}`}><Icon size={18} /></span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  );
}

function formatBookingDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(value));
}

function useMyBookings() {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setBookings(await listMyBookings());
      setError('');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Bookings could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cancel = async (booking: ApiBooking) => {
    if (!window.confirm(`Cancel the booking for ${booking.event_name}?`)) return;
    setCancellingId(booking.id);
    try {
      await cancelBooking(booking.id, 'Cancelled by the requester');
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The booking could not be cancelled.');
    } finally {
      setCancellingId(null);
    }
  };
  return { bookings, isLoading, error, cancellingId, cancel };
}

function BookingPanel({
  bookings,
  isLoading,
  error,
  cancellingId,
  onCancel,
}: {
  bookings: ApiBooking[];
  isLoading: boolean;
  error: string;
  cancellingId: string | null;
  onCancel: (booking: ApiBooking) => Promise<void>;
}) {
  if (isLoading) return <p className="form-status">Loading your bookings…</p>;
  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (bookings.length === 0) return <div className="empty-state"><h3>No bookings yet</h3><p>Book a venue to see it here.</p></div>;
  return <div className="booking-list">{bookings.map((booking) => <article className="dashboard-booking-row" key={booking.id}>
    <span className="booking-thumb"><CalendarCheck size={18} /></span>
    <div className="booking-row-main"><strong>{booking.venue_name}</strong><span>{formatBookingDate(booking.starts_at)} – {formatBookingDate(booking.ends_at)}</span><small>{booking.event_name} · {booking.expected_attendance} attendees</small></div>
    <span className={`status-pill status-pill--${booking.status.toLowerCase()}`}>{booking.status}</span>
    {booking.status === 'CONFIRMED' && <button className="text-button" type="button" disabled={cancellingId === booking.id} onClick={() => void onCancel(booking)}>{cancellingId === booking.id ? 'Cancelling…' : 'Cancel'}</button>}
    <Link to={`/venues/${booking.venue_id}`} className="row-chevron" aria-label={`View ${booking.venue_name}`}><ChevronRight size={17} /></Link>
  </article>)}</div>;
}

export function StudentDashboardPage() {
  const bookingData = useMyBookings();
  return (
    <div className="page-wrap page-wrap--wide dashboard-page">
      <DashboardShell>
        <div className="dashboard-welcome">
          <div><span className="eyebrow">STUDENT SPACE</span><h1>Good morning, John!</h1><p>Here’s what’s happening with your events and bookings.</p></div>
          <Link className="button button--soft" to="/events">Explore events <ArrowRight size={15} /></Link>
        </div>
        <div className="metric-grid">
          <MetricCard label="Bookings" value={String(bookingData.bookings.length)} icon={CalendarCheck} tone="blue" />
          <MetricCard label="Registered events" value="3" icon={CalendarDays} tone="purple" />
          <MetricCard label="Notifications" value="1" icon={Bell} tone="peach" />
        </div>
        <section className="dashboard-panel" id="bookings">
          <div className="panel-heading"><div><h2>Upcoming bookings</h2><p>Your next campus spaces.</p></div><Link className="text-link" to="/venues">Find a venue <ArrowRight size={15} /></Link></div>
          <BookingPanel bookings={bookingData.bookings} isLoading={bookingData.isLoading} error={bookingData.error} cancellingId={bookingData.cancellingId} onCancel={bookingData.cancel} />
        </section>
        <section className="dashboard-panel" id="my-events">
          <div className="panel-heading"><div><h2>My events</h2><p>Plans you’ve saved for the semester.</p></div><Link className="text-link" to="/events">Browse all <ArrowRight size={15} /></Link></div>
          <div className="my-event-row"><img src={events[0].image} alt="" /><div><strong>{events[0].title}</strong><span>{events[0].date} · {events[0].location}</span></div><span className="status-pill status-pill--registered">Registered</span></div>
        </section>
        <section className="dashboard-panel" id="profile">
          <div className="panel-heading"><div><h2>Your profile</h2><p>Campus details shown in this preview.</p></div><UserRound size={18} aria-hidden="true" /></div>
          <div className="account-details-grid">
            <div><span>Full name</span><strong>John Doe</strong></div>
            <div><span>Email</span><strong>john.doe@campus.edu</strong></div>
            <div><span>Account type</span><strong>Student</strong></div>
          </div>
        </section>
        <section className="dashboard-panel" id="settings">
          <div className="panel-heading"><div><h2>Notification settings</h2><p>Choose which demo updates you want to see.</p></div><Settings size={18} aria-hidden="true" /></div>
          <div className="settings-list">
            <label><input type="checkbox" defaultChecked /> Booking status and venue updates</label>
            <label><input type="checkbox" defaultChecked /> Event registration reminders</label>
            <label><input type="checkbox" /> Campus organization news</label>
          </div>
          <p className="demo-notice"><span>i</span>These preferences are temporary and are not saved outside this preview.</p>
        </section>
      </DashboardShell>
    </div>
  );
}

const organizerEvents = [
  { event: events[0], status: 'Published' },
  { event: events[1], status: 'Published' },
  { event: events[2], status: 'Draft' },
];

type EventDraft = { title: string; date: string; location: string; category: string; description: string };
const emptyEventDraft: EventDraft = { title: '', date: '', location: 'Main Campus', category: 'Workshop', description: '' };

export function OrganizerDashboardPage() {
  const bookingData = useMyBookings();
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(emptyEventDraft);
  const [draftMessage, setDraftMessage] = useState('');

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftMessage(`“${draft.title.trim()}” is saved as a local demo draft. It has not been published.`);
    setCreatingEvent(false);
    setDraft(emptyEventDraft);
  };

  return (
    <div className="page-wrap page-wrap--wide dashboard-page">
      <DashboardShell organizer>
        <div className="dashboard-welcome">
          <div><span className="eyebrow">ORGANIZATION WORKSPACE</span><h1>Welcome back, Tech Club!</h1><p>Manage your events, bookings, and registrations.</p></div>
          <button className="button button--primary" type="button" onClick={() => { setCreatingEvent((value) => !value); setDraftMessage(''); }}>
            {creatingEvent ? 'Close event form' : 'Create event'} <span aria-hidden="true">{creatingEvent ? '−' : '+'}</span>
          </button>
        </div>
        {draftMessage && <p className="inline-success" role="status">{draftMessage}</p>}
        {creatingEvent && (
          <form className="dashboard-panel create-event-panel" onSubmit={saveDraft}>
            <div className="panel-heading"><div><h2>Create an event draft</h2><p>Enter the basics. This stays in the temporary frontend preview.</p></div></div>
            <div className="form-grid">
              <div className="form-field form-field--full"><label htmlFor="organizer-event-title">Event name</label><input id="organizer-event-title" required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Student Innovation Night" /></div>
              <div className="form-field"><label htmlFor="organizer-event-date">Event date</label><input id="organizer-event-date" type="date" required value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></div>
              <div className="form-field"><label htmlFor="organizer-event-location">Location</label><select id="organizer-event-location" value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}><option>Main Campus</option><option>Campus Grounds</option><option>Lecture Hall A</option></select></div>
              <div className="form-field"><label htmlFor="organizer-event-category">Event type</label><select id="organizer-event-category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}><option>Workshop</option><option>Seminar</option><option>Conference</option><option>Cultural</option><option>Social</option><option>Sports</option></select></div>
              <div className="form-field form-field--full"><label htmlFor="organizer-event-description">Description <span className="muted">(optional)</span></label><textarea id="organizer-event-description" rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What should students know about this event?" /></div>
            </div>
            <div className="booking-form-actions"><button type="button" className="button button--outline" onClick={() => setCreatingEvent(false)}>Cancel</button><button type="submit" className="button button--primary">Save local draft <Check size={16} /></button></div>
          </form>
        )}
        <div className="metric-grid metric-grid--four">
          <MetricCard label="Total events" value="5" icon={CalendarDays} tone="blue" />
          <MetricCard label="Total registrations" value="342" icon={Users} tone="mint" />
          <MetricCard label="Upcoming events" value="2" icon={Activity} tone="peach" />
          <MetricCard label="Bookings" value="4" icon={CalendarCheck} tone="purple" />
        </div>
        <div className="organizer-columns">
          <section className="dashboard-panel organizer-events-panel" id="events">
            <div className="panel-heading"><div><h2>Recent events</h2><p>Keep your campus calendar moving.</p></div><Link className="text-link" to="/events">View all <ArrowRight size={15} /></Link></div>
            <div className="organizer-event-list">
              {organizerEvents.map(({ event: campusEvent, status }) => (
                <article className="organizer-event-row" key={campusEvent.id}><img src={campusEvent.image} alt="" /><div><strong>{campusEvent.title}</strong><span>{campusEvent.dateShort} · {campusEvent.location}</span></div><span className={`status-pill status-pill--${status.toLowerCase()}`}>{status}</span></article>
              ))}
            </div>
          </section>
          <section className="dashboard-panel registration-panel" id="registrations">
            <div className="panel-heading"><div><h2>Registration overview</h2><p>Activity this semester</p></div><button className="icon-button" type="button" aria-label="Registration report details"><ChartNoAxesColumn size={17} /></button></div>
            <div className="chart-total"><strong>342</strong><span>registrations</span><em>+18.4%</em></div>
            <svg className="registration-chart" viewBox="0 0 440 150" role="img" aria-label="Illustrative registration trend for February through April"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5b50f6" stopOpacity=".22" /><stop offset="1" stopColor="#5b50f6" stopOpacity="0" /></linearGradient></defs><path d="M0 124 C38 112 39 91 78 102 S128 76 164 82 S224 104 257 63 S310 48 342 71 S394 26 440 15 L440 150 L0 150Z" fill="url(#chart-fill)" /><path d="M0 124 C38 112 39 91 78 102 S128 76 164 82 S224 104 257 63 S310 48 342 71 S394 26 440 15" fill="none" stroke="#564bf0" strokeWidth="3" strokeLinecap="round" /><circle cx="440" cy="15" r="5" fill="#fff" stroke="#564bf0" strokeWidth="3" /></svg>
            <div className="chart-labels"><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span></div>
          </section>
        </div>
        <section className="dashboard-panel" id="upcoming-events">
          <div className="panel-heading"><div><h2>Upcoming Events</h2><p>Keep your campus community informed about what’s next.</p></div><Link className="text-link" to="/events">View all <ArrowRight size={15} /></Link></div>
          <div className="organizer-event-list">
            {events.slice(0, 2).map((campusEvent) => (
              <article className="organizer-event-row" key={`upcoming-${campusEvent.id}`}><img src={campusEvent.image} alt="" /><div><strong>{campusEvent.title}</strong><span>{campusEvent.dateShort} · {campusEvent.location}</span></div><span className="status-pill status-pill--published">Registration open</span></article>
            ))}
          </div>
        </section>
        <section className="dashboard-panel" id="bookings">
          <div className="panel-heading"><div><h2>Venue bookings</h2><p>Spaces requested for your organization.</p></div><Link className="text-link" to="/venues">Find a venue <ArrowRight size={15} /></Link></div>
          <BookingPanel bookings={bookingData.bookings} isLoading={bookingData.isLoading} error={bookingData.error} cancellingId={bookingData.cancellingId} onCancel={bookingData.cancel} />
        </section>
        <section className="dashboard-panel" id="announcements">
          <div className="panel-heading"><div><h2>Announcements</h2><p>Updates for your campus community.</p></div><Megaphone size={18} aria-hidden="true" /></div>
          <div className="announcement-row"><span className="metric-icon metric-icon--blue"><CalendarDays size={17} /></span><div><strong>Innovation & Tech Day is coming up</strong><span>Registration is open for April 12. Share the event with your members.</span></div></div>
          <div className="announcement-row"><span className="metric-icon metric-icon--peach"><Bell size={17} /></span><div><strong>Review your venue requests</strong><span>Check booking statuses before your next event.</span></div></div>
        </section>
        <section className="dashboard-panel" id="settings">
          <div className="panel-heading"><div><h2>Organization settings</h2><p>Manage demo workspace notifications.</p></div><Settings size={18} aria-hidden="true" /></div>
          <div className="settings-list"><label><input type="checkbox" defaultChecked /> Registration activity updates</label><label><input type="checkbox" defaultChecked /> Venue booking status updates</label><label><input type="checkbox" /> Weekly organization summary</label></div>
          <p className="demo-notice"><span>i</span>These preferences are temporary and are not saved outside this preview.</p>
        </section>
      </DashboardShell>
    </div>
  );
}

function notificationIcon(type: NotificationType) {
  if (type === 'CONFIRMED' || type === 'CANCELLED') return CalendarCheck;
  if (type === 'REMINDER') return Bell;
  return ClipboardList;
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(value));
}

function notifyCountChanged() {
  window.dispatchEvent(new Event('unispot:notifications-changed'));
}

export function NotificationsPage() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const unread = items.filter((item) => item.delivery_status !== 'READ' && !item.read_at).length;

  useEffect(() => {
    let active = true;
    listMyNotifications().then((notifications) => {
      if (active) setItems(notifications);
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof ApiError ? requestError.message : 'Notifications could not be loaded.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const markRead = async (notificationId: string) => {
    setBusyId(notificationId);
    setError('');
    try {
      const updated = await markNotificationRead(notificationId);
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      notifyCountChanged();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The notification could not be marked as read.');
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    const unreadItems = items.filter((item) => item.delivery_status !== 'READ' && !item.read_at);
    setBusyId('all');
    setError('');
    try {
      const updated = await Promise.all(unreadItems.map((item) => markNotificationRead(item.id)));
      setItems((current) => current.map((item) => updated.find((notification) => notification.id === item.id) || item));
      notifyCountChanged();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Notifications could not be marked as read.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-wrap notifications-page">
      <div className="page-heading page-heading--split"><div><span className="eyebrow">CAMPUS UPDATES</span><h1>Notifications</h1><p>Stay in the loop with your bookings and events.</p></div><button type="button" className="button button--outline" onClick={() => void markAllRead()} disabled={busyId !== null || unread === 0}><ShieldCheck size={16} />{busyId === 'all' ? 'Marking read…' : 'Mark all as read'}</button></div>
      <div className="notifications-summary"><span className="notification-count">{unread}</span><span><strong>{unread} unread</strong><small>Recent updates from your campus activity</small></span><Link className="text-link" to="/student/dashboard">Back to dashboard <ArrowRight size={15} /></Link></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {isLoading && <p className="form-status">Loading notifications…</p>}
      {!isLoading && !error && items.length === 0 && <div className="empty-state"><h2>No notifications yet</h2><p>Booking and campus updates will appear here.</p></div>}
      {!isLoading && <div className="notification-list">{items.map((item) => {
        const read = item.delivery_status === 'READ' || item.read_at !== null;
        const Icon = notificationIcon(item.type);
        return <article className={`notification-card${read ? '' : ' notification-card--unread'}`} key={item.id}>
          <span className="notification-icon"><Icon size={19} /></span><div><h2>{item.title}</h2><p>{item.body}</p><span className="notification-time">{formatNotificationTime(item.created_at)}</span></div>
          {!read && <button className="mark-read-button" type="button" disabled={busyId !== null} aria-label={`Mark as read: ${item.title}`} onClick={() => void markRead(item.id)}><Check size={16} /></button>}
        </article>;
      })}</div>}
      <div className="notification-help"><div><span className="help-icon"><Bell size={18} /></span><div><strong>Want fewer updates?</strong><p>Manage the kind of campus updates you see in your profile settings.</p></div></div><Link to="/student/dashboard#settings" className="text-link">Notification settings <ArrowRight size={15} /></Link></div>
    </div>
  );
}
