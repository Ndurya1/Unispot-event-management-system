import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getVenue } from '../api/venues';
import { ApiError } from '../api/client';
import { createBooking } from '../api/bookings';
import type { ApiBooking, ApiVenue } from '../api/types';
import { useAuth } from '../auth/AuthProvider';

type BookingFormState = { eventName: string; date: string; startTime: string; endTime: string; attendance: string; purpose: string; additional: string; organizationId: string };

function timeToMinutes(value: string) {
  const [hours, minutes] = to24HourTime(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function to24HourTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return value;
  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function toNairobiDateTime(date: string, time: string) {
  return `${date}T${to24HourTime(time)}:00+03:00`;
}

export function BookingPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const bookingVenueId = params.get('venue');
  const initialDate = params.get('date') ?? '';
  const initialSlot = params.get('slot') ?? '';
  const [apiVenue, setApiVenue] = useState<ApiVenue | null>(null);
  const [venueError, setVenueError] = useState('');
  useEffect(() => {
    if (!bookingVenueId) { setVenueError('Choose a venue from the live venue catalog before booking.'); return; }
    let active = true;
    getVenue(bookingVenueId).then((result) => { if (active) setApiVenue(result); }).catch(() => { if (active) setVenueError('This venue could not be loaded.'); });
    return () => { active = false; };
  }, [bookingVenueId]);
  const [form, setForm] = useState<BookingFormState>(() => {
    const [startTime = '', endTime = ''] = initialSlot.includes('–') ? initialSlot.split(' – ') : initialSlot.split(' - ');
    return { eventName: '', date: initialDate, startTime, endTime, attendance: '', purpose: '', additional: '', organizationId: '' };
  });
  useEffect(() => {
    if (!initialSlot) return;
    const [startTime = '', endTime = ''] = initialSlot.includes('–') ? initialSlot.split(' – ') : initialSlot.split(' - ');
    setForm((current) => ({ ...current, startTime, endTime }));
  }, [initialSlot]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<ApiBooking | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const organizations = user?.organizations ?? [];
  useEffect(() => {
    if (!form.organizationId && organizations.length > 0) setForm((current) => ({ ...current, organizationId: organizations[0].organization_id }));
  }, [form.organizationId, organizations]);
  const update = (key: keyof BookingFormState, value: string) => { idempotencyKeyRef.current = null; setForm((current) => ({ ...current, [key]: value })); };
  const updateTime = (key: 'startTime' | 'endTime', value: string) => { idempotencyKeyRef.current = null; setForm((current) => ({ ...current, [key]: value })); };
  const startTimes = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const endTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  if (!bookingVenueId || venueError) return <div className="page-wrap"><div className="empty-state"><h2>Venue unavailable</h2><p>{venueError || 'Select a venue to book.'}</p><Link className="button button--primary" to="/venues">Browse venues</Link></div></div>;
  if (!apiVenue) return <div className="page-wrap"><div className="empty-state"><h2>Loading booking venue…</h2></div></div>;

  const submitBooking = async () => {
    setError('');
    if (!form.organizationId) { setError('Select an organization before submitting the booking.'); return; }
    setSubmitting(true);
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    try {
      const booking = await createBooking({
        venue_id: apiVenue.id,
        organization_id: form.organizationId,
        event_name: form.eventName.trim(),
        purpose: [form.purpose, form.additional.trim()].filter(Boolean).join('\n\n') || undefined,
        expected_attendance: Number(form.attendance),
        starts_at: toNairobiDateTime(form.date, form.startTime),
        ends_at: toNairobiDateTime(form.date, form.endTime),
      }, idempotencyKey);
      setCreatedBooking(booking);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The booking could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  const continueStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (step === 1 && (!form.eventName.trim() || !form.date || !form.startTime || !form.endTime)) { setError('Please complete the event name, date, and both times to continue.'); return; }
    if (step === 1 && timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) { setError('End time must be later than start time.'); return; }
    const attendance = Number(form.attendance);
    if (step === 2 && (!Number.isInteger(attendance) || attendance < 1 || attendance > apiVenue.capacity || !form.purpose)) { setError(`Enter attendance from 1 to ${apiVenue.capacity} and choose a purpose to continue.`); return; }
    setStep((current) => Math.min(3, current + 1));
  };

  if (submitted) return <div className="page-wrap booking-page"><div className="booking-success"><span className="success-mark"><Check size={30} /></span><span className="eyebrow">BOOKING CONFIRMED</span><h1>Your venue is booked.</h1><p>Your booking was submitted successfully and the venue has been reserved.</p><div className="success-summary"><strong>{form.eventName}</strong><span>{apiVenue.name} · {form.date}</span><span>{form.startTime} – {form.endTime}</span>{createdBooking && <span>Confirmation code: {createdBooking.confirmation_code}</span>}</div><div className="success-actions"><Link className="button button--primary" to="/student/dashboard#bookings">View my bookings</Link><Link className="button button--outline" to="/venues">Find another venue</Link></div></div></div>;

  return (
    <div className="page-wrap booking-page">
      <div className="booking-head"><Link className="back-link" to={`/venues/${apiVenue.id}`}><ArrowLeft size={15} /> Back to {apiVenue.name}</Link><span className="eyebrow">VENUE BOOKING</span><h1>Book {apiVenue.name}</h1><p>Share a few details about your event to submit a booking request.</p></div>
      <div className="booking-card">
        <div className="booking-steps" aria-label="Booking steps">{[['1','Details'],['2','Attendees'],['3','Review']].map(([number, label]) => <div className={step >= Number(number) ? 'booking-step booking-step--active' : 'booking-step'} key={number}><span>{step > Number(number) ? <Check size={14} /> : number}</span><strong>{label}</strong></div>)}</div>
        <form onSubmit={continueStep} noValidate>
          {step === 1 && <div className="booking-form-section"><div className="form-section-heading"><span className="eyebrow">STEP 1 OF 3</span><h2>Tell us about your event</h2><p>Start with the essentials.</p></div><div className="form-grid"><div className="form-field form-field--full"><label htmlFor="booking-event-name">Event name</label><input id="booking-event-name" required value={form.eventName} onChange={(event) => update('eventName', event.target.value)} placeholder="e.g. Student Innovation Night" /></div><div className="form-field form-field--full"><label htmlFor="booking-date">Event date</label><input id="booking-date" type="date" required value={form.date} onChange={(event) => update('date', event.target.value)} /></div><div className="form-field"><label htmlFor="booking-start">Start time</label><select id="booking-start" value={form.startTime} onChange={(event) => updateTime('startTime', event.target.value)}><option value="">Select time</option>{startTimes.map((time) => <option key={time}>{time}</option>)}</select></div><div className="form-field"><label htmlFor="booking-end">End time</label><select id="booking-end" value={form.endTime} onChange={(event) => updateTime('endTime', event.target.value)}><option value="">Select time</option>{endTimes.map((time) => <option key={time}>{time}</option>)}</select></div></div></div>}
          {step === 2 && <div className="booking-form-section"><div className="form-section-heading"><span className="eyebrow">STEP 2 OF 3</span><h2>Plan for your attendees</h2><p>Help us understand the kind of gathering you have in mind.</p></div><div className="form-grid"><div className="form-field"><label htmlFor="booking-attendance">Expected attendance</label><input id="booking-attendance" type="number" min="1" max={apiVenue.capacity} value={form.attendance} onChange={(event) => update('attendance', event.target.value)} placeholder={`Up to ${apiVenue.capacity}`} /></div><div className="form-field"><label htmlFor="booking-organization">Booking organization</label><select id="booking-organization" value={form.organizationId} onChange={(event) => update('organizationId', event.target.value)}><option value="">Select organization</option>{organizations.map((organization: {organization_id:string; name:string}) => <option value={organization.organization_id} key={organization.organization_id}>{organization.name}</option>)}</select></div><div className="form-field"><label htmlFor="booking-purpose">Purpose of booking</label><select id="booking-purpose" value={form.purpose} onChange={(event) => update('purpose', event.target.value)}><option value="">Select purpose</option><option>Workshop</option><option>Club meeting</option><option>Conference</option><option>Social event</option><option>Other campus event</option></select></div><div className="form-field form-field--full"><label htmlFor="booking-notes">Additional information <span className="muted">(optional)</span></label><textarea id="booking-notes" rows={4} value={form.additional} onChange={(event) => update('additional', event.target.value)} placeholder="Share any setup or accessibility notes." /></div></div>{organizations.length === 0 && <p className="form-error" role="alert">Your account has no active organization membership for booking.</p>}</div>}
          {step === 3 && <div className="booking-form-section"><div className="form-section-heading"><span className="eyebrow">STEP 3 OF 3</span><h2>Review your booking</h2><p>Check your details before submitting the booking.</p></div><div className="review-card"><div><span>Event name</span><strong>{form.eventName}</strong></div><div><span>Venue</span><strong>{apiVenue.name} · {apiVenue.location}</strong></div><div><span>Date and time</span><strong>{form.date} · {form.startTime} – {form.endTime}</strong></div><div><span>Attendance</span><strong>{form.attendance} people</strong></div><div><span>Organization</span><strong>{organizations.find((organization: any) => organization.organization_id === form.organizationId)?.name || 'Not selected'}</strong></div><div><span>Purpose</span><strong>{form.purpose}</strong></div>{form.additional && <div><span>Additional information</span><strong>{form.additional}</strong></div>}</div></div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="booking-form-actions">{step > 1 ? <button type="button" className="button button--outline" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</button> : <button type="button" className="button button--outline" onClick={() => navigate(`/venues/${apiVenue.id}`)}>Cancel</button>}{step < 3 ? <button className="button button--primary" type="submit">Continue <ArrowRight size={16} /></button> : <button className="button button--primary" type="button" onClick={submitBooking} disabled={submitting}>{submitting ? 'Submitting…' : 'Confirm booking'} <Check size={16} /></button>}</div>
        </form>
      </div>
      <div className="booking-footnote"><CalendarDays size={17} /><span><strong>{apiVenue.name}</strong><br />Capacity {apiVenue.capacity} · {apiVenue.location}</span><span className="footnote-slot"><Clock3 size={15} />{form.startTime && form.endTime ? `${form.startTime} – ${form.endTime}` : 'Select a time'}</span></div>
    </div>
  );
}
