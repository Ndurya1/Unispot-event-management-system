import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Check, Clock3, LoaderCircle, Pause, Play, Plus } from 'lucide-react';
import { listVenues } from '../../api/venues';
import { cancelWaitlist, createRecurring, createWaitlist, listMyRecurring, listMyWaitlists, updateRecurring } from '../../api/scheduling';
import { ApiError } from '../../api/client';
import type { ApiRecurringSchedule, ApiVenue, ApiWaitlist } from '../../api/types';
import { StatusMessage, ServicePageHeading, WorkspacePanel } from './shared';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function apiMessage(error: unknown) { return error instanceof ApiError ? error.message : 'The request could not be completed. Please try again.'; }

export function WaitlistsRecurringPage() {
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [waitlists, setWaitlists] = useState<ApiWaitlist[]>([]);
  const [recurring, setRecurring] = useState<ApiRecurringSchedule[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [v, w, r] = await Promise.all([listVenues({ limit: 50 }), listMyWaitlists(), listMyRecurring()]);
      setVenues(v);
      setWaitlists(w);
      setRecurring(r);
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const item = await createWaitlist({
        venue_id: String(form.get('venueId') || ''),
        requested_date: String(form.get('date') || ''),
        requested_start: String(form.get('start') || ''),
        requested_end: String(form.get('end') || ''),
        event_name: String(form.get('eventName') || ''),
      });
      setNotice({ tone: 'success', text: `Waitlist entry confirmed for ${item.venue_name}. Confirmation code: ${item.confirmation_code}.` });
      (event.currentTarget as HTMLFormElement).reset();
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveWaitlist(id: string) {
    try {
      const item = await cancelWaitlist(id);
      setNotice({ tone: 'success', text: `Waitlist entry cancelled for ${item.venue_name}.` });
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    }
  }

  async function submitRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const item = await createRecurring({
        venue_id: String(form.get('venueId') || ''),
        event_name: String(form.get('eventName') || ''),
        day_of_week: Number(form.get('dayOfWeek') || 0),
        start_time: String(form.get('startTime') || ''),
        end_time: String(form.get('endTime') || ''),
        starts_on: String(form.get('startsOn') || new Date().toISOString().slice(0,10)),
        ends_on: String(form.get('endsOn') || new Date(Date.now()+90*86400000).toISOString().slice(0,10)),
      });
      setNotice({ tone: 'success', text: `Recurring schedule confirmed for ${item.venue_name}. Confirmation code: ${item.confirmation_code}.` });
      setFormOpen(false);
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleRecurring(item: ApiRecurringSchedule) {
    try {
      const next = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await updateRecurring(item.id, next);
      setNotice({ tone: 'success', text: `Recurring schedule ${next === 'ACTIVE' ? 'resumed' : 'paused'}.` });
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    }
  }

  return (
    <section className="sd-page sd-waitlist-page">
      <ServicePageHeading title="Waitlists & Recurring Bookings" description="Join waitlists for venues and manage schedules for regular campus events." />
      <StatusMessage tone={notice?.tone ?? 'info'}>{notice?.text}</StatusMessage>
      <div className="sd-waitlist-columns">
        <WorkspacePanel title="My Waitlists" action={<span className="sd-subtle-count">{waitlists.filter((w) => w.status === 'WAITING').length} active</span>} titleId="my-waitlists-title" className="sd-waitlists-panel">
          <form className="sd-recurring-form" onSubmit={submitWaitlist}>
            <div className="sd-form-grid">
              <label className="sd-field"><span>Venue</span><select name="venueId" required>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
              <label className="sd-field"><span>Event name</span><input name="eventName" required placeholder="e.g. Club meeting" /></label>
              <label className="sd-field"><span>Date</span><input name="date" type="date" required /></label>
              <label className="sd-field"><span>Start</span><input name="start" type="time" required defaultValue="10:00" /></label>
              <label className="sd-field"><span>End</span><input name="end" type="time" required defaultValue="12:00" /></label>
            </div>
            <button className="button button--primary" type="submit" disabled={submitting || loading}>{submitting ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />} Join Waitlist</button>
          </form>
          <div className="sd-recurring-list" style={{ marginTop: 16 }}>
            {waitlists.map((item) => (
              <article className="sd-waitlist-card" key={item.id}>
                <div className="sd-waitlist-card-top"><span className="sd-waitlist-icon"><CalendarDays size={17} /></span><span className={`sd-status ${(item.status === 'WAITING' || item.status === 'NOTIFIED') ? 'sd-status--pending' : 'sd-status--info'}`}>{item.status}</span></div>
                <h3>{item.venue_name}</h3><p><CalendarDays size={13} />{item.requested_date} · {item.requested_start}–{item.requested_end}</p><small>{item.event_name} · {item.confirmation_code}</small>
                {(item.status === 'WAITING' || item.status === 'NOTIFIED') && <button className="button button--outline button--small" type="button" onClick={() => void leaveWaitlist(item.id)}>Leave Waitlist</button>}
              </article>
            ))}
            {!loading && waitlists.length === 0 && <p>No waitlist entries yet.</p>}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Recurring Bookings" action={<button className="sd-link-button" type="button" onClick={() => setFormOpen((open) => !open)}><Plus size={14} />Create Recurring Schedule</button>} titleId="recurring-bookings-title" className="sd-recurring-panel">
          <div className="sd-recurring-list">{recurring.map((item) => (
            <article className="sd-recurring-card" key={item.id}><div className="sd-recurring-symbol"><CalendarDays size={17} /></div><div className="sd-recurring-copy"><h3>{item.event_name}</h3><p><Clock3 size={13} />Every {DAYS[item.day_of_week] ?? item.day_of_week} · {item.start_time}–{item.end_time}</p><span>⌖ {item.venue_name} · {item.confirmation_code}</span></div><button className={`sd-status-toggle${item.status === 'ACTIVE' ? ' sd-status-toggle--active' : ''}`} type="button" aria-pressed={item.status === 'ACTIVE'} onClick={() => void toggleRecurring(item)}>{item.status === 'ACTIVE' ? <><Check size={12} />Active <Pause size={12} />Pause</> : <><Play size={12} />Resume</>}</button></article>
          ))}{!loading && recurring.length === 0 && <p>No recurring schedules yet.</p>}</div>
          {formOpen && <form className="sd-recurring-form" onSubmit={submitRecurring}><div className="sd-form-grid"><label className="sd-field"><span>Event Name</span><input name="eventName" required placeholder="Weekly club meeting" /></label><label className="sd-field"><span>Venue</span><select name="venueId" required>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label className="sd-field"><span>Day</span><select name="dayOfWeek">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label><label className="sd-field"><span>Start Time</span><input name="startTime" type="time" required defaultValue="14:00" /></label><label className="sd-field"><span>End Time</span><input name="endTime" type="time" required defaultValue="16:00" /></label><label className="sd-field"><span>Starts on</span><input name="startsOn" type="date" required defaultValue={new Date().toISOString().slice(0,10)} /></label><label className="sd-field"><span>Ends on</span><input name="endsOn" type="date" required defaultValue={new Date(Date.now()+90*86400000).toISOString().slice(0,10)} /></label></div><div className="sd-form-actions"><button className="button button--outline" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Save Schedule</button></div></form>}
        </WorkspacePanel>
      </div>
    </section>
  );
}
