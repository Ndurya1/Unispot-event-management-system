import { useState, type FormEvent } from 'react';
import { Bell, CalendarDays, Check, Clock3, Pause, Play, Plus, UsersRound } from 'lucide-react';
import { DemoMessage, ServicePageHeading, WorkspacePanel } from './shared';

type RecurringBooking = { id: string; name: string; venue: string; schedule: string; status: 'Active' | 'Paused' };
const initialBookings: RecurringBooking[] = [
  { id: 'tech-club', name: 'Tech Club Weekly Meeting', venue: 'Great Hall', schedule: 'Every Wednesday · 2:00 PM – 4:00 PM', status: 'Active' },
  { id: 'honors-society', name: 'Honors Society Meeting', venue: 'Seminar Room A', schedule: 'Every Friday · 5:00 PM – 8:00 PM', status: 'Active' },
];

export function WaitlistsRecurringPage() {
  const [waitlisted, setWaitlisted] = useState<Record<string, boolean>>({ 'great-hall': true, 'seminar-room-b': true });
  const [bookings, setBookings] = useState(initialBookings);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const createRecurring = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('eventName') || 'New recurring event');
    const venue = String(form.get('venue') || 'Great Hall');
    const day = String(form.get('day') || 'Wednesday');
    const start = String(form.get('startTime') || '2:00 PM');
    const end = String(form.get('endTime') || '4:00 PM');
    setBookings((current) => [...current, { id: `demo-${Date.now()}`, name, venue, schedule: `Every ${day} · ${start} – ${end}`, status: 'Active' }]);
    setFormOpen(false);
    setNotice('Added to this page’s temporary demo schedule. No venue was booked and nobody was notified.');
  };

  const toggleBooking = (id: string) => {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status: booking.status === 'Active' ? 'Paused' : 'Active' } : booking));
    setNotice('Recurring status changed in this preview only; no reservation was updated.');
  };

  return (
    <section className="sd-page sd-waitlist-page">
      <ServicePageHeading title="Waitlists & Recurring Bookings" description="Join waitlists for popular venues and manage schedules for regular campus events." />
      <div className="sd-waitlist-columns">
        <WorkspacePanel title="My Waitlists" action={<span className="sd-subtle-count">2 entries</span>} titleId="my-waitlists-title" className="sd-waitlists-panel">
          <article className="sd-waitlist-card"><div className="sd-waitlist-card-top"><span className="sd-waitlist-icon"><CalendarDays size={17} /></span><span className="sd-status sd-status--pending">Waiting</span></div><h3>Great Hall</h3><p><CalendarDays size={13} />12 Apr 2026 · 10:00 AM – 4:00 PM</p><small>Currently unavailable</small><button className="button button--outline button--small" type="button" onClick={() => { setWaitlisted((current) => ({ ...current, 'great-hall': !current['great-hall'] })); setNotice(waitlisted['great-hall'] ? 'You left the Great Hall demo waitlist.' : 'You joined the Great Hall demo waitlist.'); }}>{waitlisted['great-hall'] ? 'Leave Waitlist' : 'Join Waitlist'}</button></article>
          <article className="sd-waitlist-card"><div className="sd-waitlist-card-top"><span className="sd-waitlist-icon sd-waitlist-icon--blue"><CalendarDays size={17} /></span><span className="sd-status sd-status--info">Position #2</span></div><h3>Seminar Room B</h3><p><CalendarDays size={13} />16 Apr 2026 · 2:00 PM – 5:00 PM</p><small>2nd in queue</small><button className="button button--outline button--small" type="button" onClick={() => setNotice('Seminar Room B is still 2nd in the sample queue. No live availability check is connected.')}>View Details</button></article>
          <div className="sd-waitlist-helper"><Bell size={16} /><span>Notifications for waitlist openings are preview-only.</span></div>
        </WorkspacePanel>

        <WorkspacePanel title="Recurring Bookings" action={<button className="sd-link-button" type="button" onClick={() => { setFormOpen((open) => !open); setNotice(''); }}><Plus size={14} />Create Recurring Booking</button>} titleId="recurring-bookings-title" className="sd-recurring-panel">
          <div className="sd-recurring-list">{bookings.map((booking) => <article className="sd-recurring-card" key={booking.id}><div className="sd-recurring-symbol"><CalendarDays size={17} /></div><div className="sd-recurring-copy"><h3>{booking.name}</h3><p><Clock3 size={13} />{booking.schedule}</p><span><MapPinTiny />{booking.venue}</span></div><button className={`sd-status-toggle${booking.status === 'Active' ? ' sd-status-toggle--active' : ''}`} type="button" aria-pressed={booking.status === 'Active'} onClick={() => toggleBooking(booking.id)}>{booking.status === 'Active' ? <><Check size={12} />Active <Pause size={12} />Pause</> : <><Play size={12} />Resume</>}</button></article>)}</div>
          {formOpen && <form className="sd-recurring-form" onSubmit={createRecurring}><div className="sd-form-grid"><label className="sd-field"><span>Event Name</span><input name="eventName" required placeholder="Weekly club meeting" /></label><label className="sd-field"><span>Venue</span><select name="venue"><option>Great Hall</option><option>Seminar Room B</option><option>Seminar Room A</option></select></label><label className="sd-field"><span>Day</span><select name="day"><option>Wednesday</option><option>Monday</option><option>Tuesday</option><option>Thursday</option><option>Friday</option></select></label><label className="sd-field"><span>Start Time</span><input name="startTime" type="time" required defaultValue="14:00" /></label><label className="sd-field"><span>End Time</span><input name="endTime" type="time" required defaultValue="16:00" /></label></div><div className="sd-form-actions"><button className="button button--outline" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Add Demo Schedule</button></div></form>}
          <DemoMessage>{notice}</DemoMessage>
        </WorkspacePanel>
      </div>
      <p className="sd-footnote"><UsersRound size={14} aria-hidden="true" /> Changes on this screen are temporary and do not reserve a venue or trigger a notification.</p>
    </section>
  );
}

function MapPinTiny() {
  return <span aria-hidden="true">⌖</span>;
}
