import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, LoaderCircle, Mail, MapPin, Phone, ShieldCheck, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { createEventRegistration, listCampusEvents, listMyEventRegistrations } from '../../api/events';
import { ApiError } from '../../api/client';
import type { ApiCampusEvent, ApiEventRegistration } from '../../api/types';
import { BackToServices, StatusMessage, ServicePageHeading, WorkspacePanel } from './shared';

const benefits = [
  { label: 'Online registration', icon: Check },
  { label: 'Capacity tracking', icon: Check },
  { label: 'Confirmation emails', icon: Mail },
  { label: 'Attendance management', icon: UsersRound },
];

function fmtDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtShort(value: string) {
  const d = new Date(value);
  return { day: d.toLocaleString(undefined, { day: '2-digit' }), month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase() };
}
function apiMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'The request could not be completed. Please try again.';
}

export function EventRegistrationPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ApiCampusEvent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [mine, setMine] = useState<ApiEventRegistration[]>([]);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selected = useMemo(() => events.find((item) => item.id === selectedId) ?? events[0] ?? null, [events, selectedId]);
  const myRegistration = useMemo(() => mine.find((item) => item.event_id === selected?.id && item.status === 'CONFIRMED') ?? null, [mine, selected]);

  async function load() {
    setLoading(true);
    try {
      const eventList = await listCampusEvents();
      setEvents(eventList);
      if (!selectedId && eventList[0]) setSelectedId(eventList[0].id);
      if (isAuthenticated) setMine(await listMyEventRegistrations());
      else setMine([]);
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [isAuthenticated]);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate('/signup', { state: { from: '/services/event-registration-rsvp', authRequired: true } });
      return;
    }
    if (!selected) return;
    if (selected.available_capacity < 1) {
      setNotice({ tone: 'warning', text: 'This event is fully booked.' });
      return;
    }
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const registration = await createEventRegistration({
        event_id: selected.id,
        full_name: String(form.get('fullName') || ''),
        email: String(form.get('email') || ''),
        
      });
      setNotice({ tone: 'success', text: `Registration confirmed for ${registration.event_title}. Confirmation code: ${registration.confirmation_code}.` });
      (event.currentTarget as HTMLFormElement).reset();
      await load();
    } catch (error) {
      setNotice({ tone: 'warning', text: apiMessage(error) });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  const date = selected ? fmtShort(selected.starts_at) : { day: '--', month: '---' };
  const percent = selected ? Math.min((selected.confirmed_registrations / selected.capacity) * 100, 100) : 0;

  return (
    <section className="sd-page sd-registration-page">
      <BackToServices />
      <ServicePageHeading title="Event Registration & RSVP" description="Register for campus events, manage your attendance, and never miss what’s happening on campus." />
      <div className="sd-benefit-strip" aria-label="Registration features">{benefits.map(({ label, icon: Icon }) => <span key={label}><Icon size={15} aria-hidden="true" />{label}</span>)}</div>
      <label className="sd-field" style={{ maxWidth: 420, marginBottom: 16 }}><span>Select event</span><select value={selected?.id ?? ''} onChange={(e) => { setSelectedId(e.target.value); setNotice(null); }}>{events.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.available_capacity} seats left</option>)}</select></label>
      {selected && <>
      <div className="sd-registration-banner">
        <div className="sd-registration-banner-shade" />
        <div className="sd-registration-banner-copy">
          <span className="sd-live-badge"><span /> {selected.category || 'CAMPUS EVENT'}</span>
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
        </div>
      </div>
      <div className="sd-registration-grid">
        <WorkspacePanel title="Event details" titleId="registration-event-title" className="sd-event-summary-panel">
          <div className="sd-event-summary-top"><span className="sd-date-tile"><strong>{date.day}</strong><small>{date.month}</small></span><div><span className="sd-eyebrow">{selected.category || 'EVENT'}</span><h3>{selected.title}</h3><p>Hosted by {selected.organizer}</p></div></div>
          <div className="sd-event-facts">
            <span><Clock3 size={15} aria-hidden="true" />{fmtDate(selected.starts_at)} – {fmtDate(selected.ends_at)}</span>
            <span><MapPin size={15} aria-hidden="true" />{selected.location}</span>
            <span><UsersRound size={15} aria-hidden="true" />{selected.capacity} seats · {selected.confirmed_registrations} registered · {selected.available_capacity} left</span>
            <span><CalendarDays size={15} aria-hidden="true" />{fmtDate(selected.starts_at)}</span>
          </div>
          <div className="sd-capacity-meter" aria-label={`${selected.confirmed_registrations} of ${selected.capacity} seats registered`}><div><span>Registration capacity</span><strong>{selected.confirmed_registrations} / {selected.capacity}</strong></div><span className="sd-capacity-track"><i style={{ width: `${percent}%` }} /></span></div>
          <div className="sd-inline-reassurance"><ShieldCheck size={16} aria-hidden="true" /><span>Registrations are confirmed automatically while capacity is available.</span></div>
        </WorkspacePanel>
        <WorkspacePanel title="Register for this event" titleId="registration-form-title" className="sd-registration-form-panel">
          {myRegistration ? (
            <div className="sd-registration-success">
              <span className="sd-success-mark"><Check size={24} aria-hidden="true" /></span>
              <h3>You’re registered.</h3>
              <p>{selected.title}</p>
              <StatusMessage tone="success">Confirmed. Confirmation code: {myRegistration.confirmation_code}.</StatusMessage>
            </div>
          ) : (
            <form className="sd-form" onSubmit={submitRegistration}>
              <label className="sd-field"><span>Full Name <b aria-hidden="true">*</b></span><input name="fullName" autoComplete="name" placeholder="Enter your full name" required /></label>
              <label className="sd-field"><span>Email Address <b aria-hidden="true">*</b></span><input name="email" type="email" autoComplete="email" placeholder="Enter your email address" required /></label>
              <label className="sd-field"><span>Phone Number <b aria-hidden="true">*</b></span><span className="sd-input-with-icon"><Phone size={15} aria-hidden="true" /><input name="phone" type="tel" autoComplete="tel" placeholder="Enter your phone number" required /></span></label>
              <label className="sd-field"><span>Student ID <small>(Optional)</small></span><input name="studentId" autoComplete="off" placeholder="Enter your student ID" /></label>
              <StatusMessage tone={notice?.tone ?? 'info'}>{notice?.text}</StatusMessage>
              <button className="button button--primary sd-form-submit" type="submit" disabled={submitting || loading || selected.available_capacity < 1}>{submitting ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Complete Registration <ArrowRight size={16} aria-hidden="true" /></button>
              <p className="sd-form-footnote">{selected.available_capacity < 1 ? 'This event is fully booked.' : 'Your registration is saved and confirmed immediately when seats are available.'}</p>
            </form>
          )}
        </WorkspacePanel>
      </div></>}
      <WorkspacePanel title="My Registrations" titleId="my-registrations-title" className="sd-equipment-form-panel">
        {mine.length ? <div className="sd-bookings-list">{mine.map((item) => <article key={item.id} className="sd-booking-row"><div><strong>{item.event_title}</strong><p>Confirmation: {item.confirmation_code} · {item.status}</p><p>{item.full_name} · {item.email}</p></div></article>)}</div> : <p>No event registrations yet.</p>}
      </WorkspacePanel>
    </section>
  );
}
