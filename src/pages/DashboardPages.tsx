import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Megaphone,
  QrCode,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { deleteMyAccount } from '../api/auth';
import { cancelBooking, listMyBookings } from '../api/bookings';
import { checkInEventRegistration, createCampusEvent, getEventAttendance, listEventRegistrationsForManagement, listManageableEvents, listMyEventRegistrations } from '../api/events';
import { listMyServiceRequests } from '../api/providers';
import { listVenues } from '../api/venues';
import type { ApiVenue } from '../api/types';
import { listMyNotifications, markNotificationRead } from '../api/notifications';
import type { ApiBooking, ApiCampusEvent, ApiEventAttendance, ApiEventRegistration, ApiNotification, ApiServiceRequest, NotificationType } from '../api/types';
import { useAuth } from '../auth/AuthProvider';

type DashboardLink = { to: string; label: string; icon: typeof CalendarDays };

function DashboardSidebar({ organizer = false }: { organizer?: boolean }) {
  const location = useLocation();
  const { user, logout } = useAuth();
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
    { to: '/organizer/dashboard#bookings', label: 'Venue Bookings', icon: CalendarCheck },
    { to: '/organizer/dashboard#services', label: 'Service Requests', icon: ClipboardList },
    { to: '/organizer/dashboard#registrations', label: 'Attendance', icon: Users },
    { to: '/organizer/dashboard#announcements', label: 'Announcements', icon: Megaphone },
    { to: '/organizer/dashboard#settings', label: 'Settings', icon: Settings },
  ];
  const links = organizer ? organizerLinks : studentLinks;

  const displayName = organizer ? (user?.organizations?.[0]?.name || user?.full_name || 'Organization') : (user?.full_name || 'User');
  const displayRole = organizer ? 'Organization' : (user?.roles?.[0] || 'Student');
  const initials = displayName.split(' ').map((part: any) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-user">
        <span className="avatar">{initials}</span>
        <div><strong>{displayName}</strong><small>{displayRole}</small></div>
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
      <Link className="dashboard-logout" to="/login" onClick={(e) => { e.preventDefault(); logout(); window.location.href = '/login'; }}><LogOut size={16} />Log out</Link>
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
  useEffect(() => {
    void load();
    const refreshBookings = () => { void load(); };
    window.addEventListener('unispot:bookings-changed', refreshBookings);
    return () => window.removeEventListener('unispot:bookings-changed', refreshBookings);
  }, [load]);
  const cancel = async (booking: ApiBooking) => {
    if (!window.confirm(`Cancel the booking for ${(booking.title || booking.venue_name)}?`)) return;
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
  if (isLoading) return <p className="form-status">Loading your bookingsâ€¦</p>;
  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (bookings.length === 0) return <div className="empty-state"><h3>No bookings yet</h3><p>Book a venue to see it here.</p></div>;
  return <div className="booking-list">{bookings.map((booking) => <article className="dashboard-booking-row" key={booking.id}>
    <span className="booking-thumb"><CalendarCheck size={18} /></span>
    <div className="booking-row-main"><strong>{booking.venue_name}</strong><span>{formatBookingDate(booking.starts_at)} â€“ {formatBookingDate(booking.ends_at)}</span><small>{(booking.title || booking.venue_name)} Â· {booking.expected_attendance} attendees</small></div>
    <span className={`status-pill status-pill--${booking.status.toLowerCase()}`}>{booking.status}</span>
    {booking.status === 'CONFIRMED' && <button className="text-button" type="button" disabled={cancellingId === booking.id} onClick={() => void onCancel(booking)}>{cancellingId === booking.id ? 'Cancellingâ€¦' : 'Cancel'}</button>}
    <Link to={`/venues/${booking.venue_id}`} className="row-chevron" aria-label={`View ${booking.venue_name}`}><ChevronRight size={17} /></Link>
  </article>)}</div>;
}

function DeleteAccountSection() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDelete = async () => {
    const confirmed = window.confirm(
      'Delete your UniSpot account permanently? Your bookings, registrations, requests, and account access will be removed. This cannot be undone.'
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      await deleteMyAccount();
      logout();
      window.location.href = '/';
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Your account could not be deleted. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="danger-zone" aria-label="Delete account">
      <h3><Trash2 size={16} aria-hidden="true" /> Delete account</h3>
      <p>Permanently delete your account and remove your access. This action cannot be undone.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        <button type="button" className="button button--danger button--small" onClick={() => void onDelete()} disabled={busy}>
          <Trash2 size={15} aria-hidden="true" /> {busy ? 'Deleting accountâ€¦' : 'Delete my account'}
        </button>
      </div>
    </div>
  );
}

export function StudentDashboardPage() {
  const bookingData = useMyBookings();
  const { user } = useAuth();
  const [myRegistrations, setMyRegistrations] = useState<ApiEventRegistration[]>([]);
  useEffect(() => { listMyEventRegistrations().then(setMyRegistrations).catch(() => setMyRegistrations([])); }, []);
  const firstName = user?.full_name?.split(' ')[0] || 'there';
  const confirmed = myRegistrations.filter((r) => r.status === 'CONFIRMED');
  return (
    <div className="page-wrap page-wrap--wide dashboard-page">
      <DashboardShell>
        <div className="dashboard-welcome">
          <div><span className="eyebrow">STUDENT SPACE</span><h1>Good morning, {firstName}!</h1><p>Here's what's happening with your events and bookings.</p></div>
          <Link className="button button--soft" to="/events">Explore events <ArrowRight size={15} /></Link>
        </div>
        <div className="metric-grid">
          <MetricCard label="Bookings" value={String(bookingData.bookings.length)} icon={CalendarCheck} tone="blue" />
          <MetricCard label="Registered events" value={String(confirmed.length)} icon={CalendarDays} tone="purple" />
          <MetricCard label="Notifications" value="—" icon={Bell} tone="peach" />
        </div>
        <section className="dashboard-panel" id="bookings">
          <div className="panel-heading"><div><h2>Upcoming bookings</h2><p>Your next campus spaces.</p></div><Link className="text-link" to="/venues">Find a venue <ArrowRight size={15} /></Link></div>
          <BookingPanel bookings={bookingData.bookings} isLoading={bookingData.isLoading} error={bookingData.error} cancellingId={bookingData.cancellingId} onCancel={bookingData.cancel} />
        </section>
        <section className="dashboard-panel" id="my-events">
          <div className="panel-heading"><div><h2>My events</h2><p>Events you've registered for.</p></div><Link className="text-link" to="/events">Browse all <ArrowRight size={15} /></Link></div>
          {confirmed.length === 0 && <p className="muted">No event registrations yet. <Link className="text-link" to="/services/event-registration-rsvp">Register for an event</Link>.</p>}
          {confirmed.map((reg) => <div className="my-event-row" key={reg.id}><div><strong>{reg.event_title}</strong><span>Confirmation: {reg.confirmation_code}</span></div><span className="status-pill status-pill--registered">{reg.status}</span></div>)}
        </section>
        <section className="dashboard-panel" id="profile">
          <div className="panel-heading"><div><h2>Your profile</h2><p>Your account details.</p></div><UserRound size={18} aria-hidden="true" /></div>
          <div className="account-details-grid">
            <div><span>Full name</span><strong>{user?.full_name || '—'}</strong></div>
            <div><span>Email</span><strong>{user?.email || '—'}</strong></div>
            <div><span>Account type</span><strong>{user?.roles?.[0] || 'Student'}</strong></div>
          </div>
        </section>
        <section className="dashboard-panel" id="settings">
          <div className="panel-heading"><div><h2>Settings</h2><p>Account actions.</p></div><Settings size={18} aria-hidden="true" /></div>
          <DeleteAccountSection />
        </section>
      </DashboardShell>
    </div>
  );
}

type EventDraft = { title: string; date: string; startTime: string; endTime: string; location: string; category: string; description: string; capacity: string; venueId: string; organizationId: string; expectedAttendance: string };
const emptyEventDraft: EventDraft = { title: '', date: '', startTime: '09:00', endTime: '11:00', location: 'Main Campus', category: 'Workshop', description: '', capacity: '50', venueId: '', organizationId: '', expectedAttendance: '' };

function fmt(iso: string) { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); }

export function OrganizerDashboardPage() {
  const bookingData = useMyBookings();
  const { user } = useAuth();
  const [events, setEvents] = useState<ApiCampusEvent[]>([]);
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ApiServiceRequest[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [registrations, setRegistrations] = useState<ApiEventRegistration[]>([]);
  const [attendance, setAttendance] = useState<ApiEventAttendance | null>(null);
  const [loadingOps, setLoadingOps] = useState(false);
  const [opsMessage, setOpsMessage] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(emptyEventDraft);
  const [draftMessage, setDraftMessage] = useState('');
  const orgName = user?.organizations?.[0]?.name || user?.full_name || 'Organization';

  const loadCore = useCallback(async () => {
    try {
      const [managed, requests, venueRows] = await Promise.all([listManageableEvents(), listMyServiceRequests(), listVenues({ status: 'ACTIVE', limit: 100 }).catch(() => [] as ApiVenue[])]);
      setEvents(managed);
      setServiceRequests(requests);
      setVenues(venueRows);
      if (!draft.organizationId && user?.organizations?.[0]?.organization_id) setDraft((d) => ({ ...d, organizationId: d.organizationId || user!.organizations![0].organization_id }));
      if (!selectedEventId && managed[0]) setSelectedEventId(managed[0].id);
    } catch (error) {
      setOpsMessage(error instanceof ApiError ? error.message : 'Organizer data could not be loaded.');
    }
  }, [selectedEventId]);
  useEffect(() => { void loadCore(); }, [loadCore]);

  const loadOps = useCallback(async (eventId: string) => {
    if (!eventId) { setRegistrations([]); setAttendance(null); return; }
    setLoadingOps(true); setOpsMessage('');
    try {
      const [regs, att] = await Promise.all([listEventRegistrationsForManagement(eventId), getEventAttendance(eventId)]);
      setRegistrations(regs); setAttendance(att);
    } catch (error) {
      setRegistrations([]); setAttendance(null);
      setOpsMessage(error instanceof ApiError ? error.message : 'Event-day operations could not be loaded.');
    } finally { setLoadingOps(false); }
  }, []);
  useEffect(() => { void loadOps(selectedEventId); }, [loadOps, selectedEventId]);

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraftMessage('');
    const starts = new Date(`${draft.date}T${draft.startTime}:00`);
    const ends = new Date(`${draft.date}T${draft.endTime}:00`);
    try {
      const venue = venues.find((v) => v.id === draft.venueId); await createCampusEvent({ title: draft.title.trim(), description: draft.description.trim() || undefined, category: draft.category, organizer: orgName, location: venue?.name || draft.location, venue_id: draft.venueId || undefined, organization_id: draft.venueId ? (draft.organizationId || user?.organizations?.[0]?.organization_id) : undefined, expected_attendance: draft.venueId ? (Math.max(1, Number(draft.expectedAttendance || draft.capacity) || 1)) : undefined, starts_at: starts.toISOString(), ends_at: ends.toISOString(), capacity: Math.max(1, Number(draft.capacity) || 1), status: 'PUBLISHED' });
      setDraftMessage(`"${draft.title.trim()}" published.`);
      setCreatingEvent(false); setDraft(emptyEventDraft);
      await loadCore();
    } catch (error) {
      setDraftMessage(error instanceof ApiError ? error.message : 'Could not publish event.');
    }
  };
  const checkIn = async (registrationId: string) => {
    try {
      await checkInEventRegistration(registrationId);
      setOpsMessage('Attendee checked in.');
      await loadOps(selectedEventId); await loadCore();
    } catch (error) {
      setOpsMessage(error instanceof ApiError ? error.message : 'Check-in failed.');
    }
  };
  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  return (
    <div className="page-wrap page-wrap--wide dashboard-page">
      <DashboardShell organizer>
        <div className="dashboard-welcome">
          <div><span className="eyebrow">ORGANIZATION WORKSPACE</span><h1>Welcome back, {orgName}!</h1><p>Book venues, request services, and manage event-day attendance.</p></div>
          <div className="button-row">
            <Link className="button button--outline" to="/venues">Book venue</Link>
            <Link className="button button--outline" to="/services/service-provider-directory">Ask for services</Link>
            <button className="button button--primary" type="button" onClick={() => { setCreatingEvent((v) => !v); setDraftMessage(''); }}>{creatingEvent ? 'Close event form' : 'Create event'} <span aria-hidden="true">{creatingEvent ? 'âˆ’' : '+'}</span></button>
          </div>
        </div>
        {draftMessage && <p className="inline-success" role="status">{draftMessage}</p>}
        {creatingEvent && (
          <form className="dashboard-panel create-event-panel" onSubmit={saveDraft}>
            <div className="panel-heading"><div><h2>Publish event</h2><p>Live event creation. Selecting a venue reserves it for the event time (policy/conflict-checked) and releases it if the event is cancelled or moved to an available slot.</p></div></div>
            <div className="form-grid">
              <div className="form-field form-field--full"><label htmlFor="organizer-event-title">Event name</label><input id="organizer-event-title" required value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} /></div>
              <div className="form-field"><label htmlFor="organizer-event-date">Date</label><input id="organizer-event-date" type="date" required value={draft.date} onChange={(e) => setDraft((c) => ({ ...c, date: e.target.value }))} /></div>
              <div className="form-field"><label htmlFor="organizer-event-start">Starts</label><input id="organizer-event-start" type="time" required value={draft.startTime} onChange={(e) => setDraft((c) => ({ ...c, startTime: e.target.value }))} /></div>
              <div className="form-field"><label htmlFor="organizer-event-end">Ends</label><input id="organizer-event-end" type="time" required value={draft.endTime} onChange={(e) => setDraft((c) => ({ ...c, endTime: e.target.value }))} /></div>
              <div className="form-field"><label htmlFor="organizer-event-capacity">Capacity</label><input id="organizer-event-capacity" type="number" min={1} required value={draft.capacity} onChange={(e) => setDraft((c) => ({ ...c, capacity: e.target.value }))} /></div>
              <div className="form-field"><label htmlFor="organizer-event-location">Location</label><input id="organizer-event-location" value={draft.location} onChange={(e) => setDraft((c) => ({ ...c, location: e.target.value }))} /></div>
              <div className="form-field"><label htmlFor="organizer-event-category">Type</label><select id="organizer-event-category" value={draft.category} onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value }))}><option>Workshop</option><option>Seminar</option><option>Conference</option><option>Cultural</option><option>Social</option><option>Sports</option></select></div>
              <div className="form-field"><label htmlFor="organizer-event-venue">Book venue <span className="muted">(optional, creates reservation)</span></label><select id="organizer-event-venue" value={draft.venueId} onChange={(e) => { const venueId = e.target.value; const v = venues.find((x) => x.id === venueId); setDraft((c) => ({ ...c, venueId, location: v?.name || c.location, capacity: v ? String(Math.min(Number(c.capacity || v.capacity), v.capacity)) : c.capacity })); }}><option value="">No venue reservation</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name} (cap {v.capacity})</option>)}</select></div>
              {draft.venueId && <div className="form-field"><label htmlFor="organizer-event-org">Organization</label><select id="organizer-event-org" value={draft.organizationId} onChange={(e) => setDraft((c) => ({ ...c, organizationId: e.target.value }))}><option value="">Select organization</option>{(user?.organizations ?? []).map((o: any) => <option key={o.organization_id} value={o.organization_id}>{o.name}</option>)}</select></div>}
              {draft.venueId && <div className="form-field"><label htmlFor="organizer-event-att">Expected attendance</label><input id="organizer-event-att" type="number" min={1} value={draft.expectedAttendance} onChange={(e) => setDraft((c) => ({ ...c, expectedAttendance: e.target.value }))} placeholder={draft.capacity} /></div>}
              <div className="form-field form-field--full"><label htmlFor="organizer-event-description">Description <span className="muted">(optional)</span></label><textarea id="organizer-event-description" rows={3} value={draft.description} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} /></div>
            </div>
            <div className="booking-form-actions"><button type="button" className="button button--outline" onClick={() => setCreatingEvent(false)}>Cancel</button><button type="submit" className="button button--primary">Publish event <Check size={16} /></button></div>
          </form>
        )}
        <div className="metric-grid metric-grid--four">
          <MetricCard label="Manageable events" value={String(events.length)} icon={CalendarDays} tone="blue" />
          <MetricCard label="Total registrations" value={String(events.reduce((n, e) => n + e.confirmed_registrations, 0))} icon={Users} tone="mint" />
          <MetricCard label="Service requests" value={String(serviceRequests.length)} icon={ClipboardList} tone="peach" />
          <MetricCard label="Venue bookings" value={String(bookingData.bookings.length)} icon={CalendarCheck} tone="purple" />
        </div>
        <section className="dashboard-panel" id="events">
          <div className="panel-heading"><div><h2>My events</h2><p>Events you can manage (creator-owned or admin; legacy organizer access where permitted).</p></div><Link className="text-link" to="/events">Public events <ArrowRight size={15} /></Link></div>
          <div className="organizer-event-list">
            {events.map((e) => (<article className="organizer-event-row" key={e.id}><div><strong>{e.title}</strong><span>{fmt(e.starts_at)} Â· {e.location || 'Campus'} Â· {e.confirmed_registrations}/{e.capacity} registered</span></div><div className="button-row"><span className={`status-pill status-pill--${e.status.toLowerCase()}`}>{e.status}</span><button type="button" className="button button--outline button--small" onClick={() => setSelectedEventId(e.id)}>Manage day</button></div></article>))}
            {events.length === 0 && <p className="muted">No manageable events yet. Create an event, or ask an admin if you need access to legacy events.</p>}
          </div>
        </section>
        <section className="dashboard-panel" id="bookings">
          <div className="panel-heading"><div><h2>Venue bookings</h2><p>Backend policy requires an active organizer membership in the selected organization.</p></div><div className="button-row"><Link className="button button--outline button--small" to="/venues">Find venues</Link><Link className="button button--primary button--small" to="/booking/new">New booking</Link></div></div>
          <BookingPanel bookings={bookingData.bookings} isLoading={bookingData.isLoading} error={bookingData.error} cancellingId={bookingData.cancellingId} onCancel={bookingData.cancel} />
        </section>
        <section className="dashboard-panel" id="services">
          <div className="panel-heading"><div><h2>Service requests</h2><p>Ask approved providers for event-day services.</p></div><Link className="text-link" to="/services/service-provider-directory">Browse directory <ArrowRight size={15} /></Link></div>
          {serviceRequests.length === 0 ? <p className="muted">No service requests yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Provider</th><th>Event</th><th>Date</th><th>Status</th><th>Confirmation</th></tr></thead><tbody>{serviceRequests.map((r) => <tr key={r.id}><td>{r.provider_name}</td><td>{r.event_name}</td><td>{fmt(r.requested_date)}</td><td><span className={`status-pill status-pill--${r.status.toLowerCase()}`}>{r.status}</span></td><td><span className="admin-mono">{r.confirmation_code}</span></td></tr>)}</tbody></table></div>}
        </section>
        <section className="dashboard-panel" id="registrations">
          <div className="panel-heading"><div><h2>Event-day attendance & operations</h2><p>Check in attendees and monitor registrations for selected event days.</p></div><QrCode size={18} aria-hidden="true" /></div>
          {events.length === 0 ? <p className="muted">Create or gain access to an event to manage attendance.</p> : <>
            <label className="admin-field" style={{ maxWidth: 520 }}><span>Event</span><select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.title} Â· {fmt(e.starts_at)}</option>)}</select></label>
            {selectedEvent && <p className="muted" style={{ marginTop: 8 }}><strong>{selectedEvent.title}</strong> â€” {fmt(selectedEvent.starts_at)} to {fmt(selectedEvent.ends_at)} Â· {selectedEvent.location || 'Campus'}</p>}
            {attendance && <div className="metric-grid metric-grid--four" style={{ marginTop: 12 }}><MetricCard label="Registered" value={String(attendance.confirmed_registrations)} icon={Users} tone="blue" /><MetricCard label="Checked in" value={String(attendance.checked_in_registrations)} icon={Check} tone="mint" /><MetricCard label="Not checked in" value={String((attendance.confirmed_registrations - attendance.checked_in_registrations))} icon={ClipboardList} tone="peach" /><MetricCard label="Attendance rate" value={`${(attendance.confirmed_registrations ? Math.round((attendance.checked_in_registrations/attendance.confirmed_registrations)*100) : 0)}%`} icon={CalendarCheck} tone="purple" /></div>}
            {opsMessage && <p className={/checked in/i.test(opsMessage) ? 'inline-success' : 'form-error'} role="status">{opsMessage}</p>}
            {loadingOps ? <p className="form-status">Loading registrationsâ€¦</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Registrant</th><th>Email</th><th>Status</th><th>Checked in</th><th>Action</th></tr></thead><tbody>{registrations.map((r) => <tr key={r.id}><td>{r.full_name}</td><td>{r.email}</td><td>{r.status}</td><td>{r.checked_in_at ? formatBookingDate(r.checked_in_at) : 'â€”'}</td><td>{r.checked_in_at ? <span className="status-pill status-pill--confirmed">Checked in</span> : <button type="button" className="button button--outline button--small" onClick={() => { void checkIn(r.id); }}>Check in</button>}</td></tr>)}{registrations.length === 0 && <tr><td className="admin-empty-cell" colSpan={5}>No registrations for this event.</td></tr>}</tbody></table></div>}
          </>}
        </section>
        <section className="dashboard-panel" id="announcements">
          <div className="panel-heading"><div><h2>Announcements</h2><p>Campus-wide announcements are managed by administrators.</p></div><Megaphone size={18} aria-hidden="true" /></div>
          <p className="muted">Use notifications for booking/event updates and contact an administrator for campus announcements.</p>
        </section>
        <section className="dashboard-panel" id="settings">
          <div className="panel-heading"><div><h2>Settings</h2><p>Account actions.</p></div><Settings size={18} aria-hidden="true" /></div>
          <DeleteAccountSection />
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
    const loadNotifications = () => listMyNotifications().then((notifications) => {
      if (active) setItems(notifications);
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof ApiError ? requestError.message : 'Notifications could not be loaded.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    void loadNotifications();
    const refreshNotifications = () => { void loadNotifications(); };
    window.addEventListener('unispot:notifications-changed', refreshNotifications);
    return () => {
      active = false;
      window.removeEventListener('unispot:notifications-changed', refreshNotifications);
    };
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
      setItems((current) => current.map((item) => updated.find((notification: any) => notification.id === item.id) || item));
      notifyCountChanged();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Notifications could not be marked as read.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-wrap notifications-page">
      <div className="page-heading page-heading--split"><div><span className="eyebrow">CAMPUS UPDATES</span><h1>Notifications</h1><p>Stay in the loop with your bookings and events.</p></div><button type="button" className="button button--outline" onClick={() => void markAllRead()} disabled={busyId !== null || unread === 0}><ShieldCheck size={16} />{busyId === 'all' ? 'Marking readâ€¦' : 'Mark all as read'}</button></div>
      <div className="notifications-summary"><span className="notification-count">{unread}</span><span><strong>{unread} unread</strong><small>Recent updates from your campus activity</small></span><Link className="text-link" to="/student/dashboard">Back to dashboard <ArrowRight size={15} /></Link></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {isLoading && <p className="form-status">Loading notificationsâ€¦</p>}
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







