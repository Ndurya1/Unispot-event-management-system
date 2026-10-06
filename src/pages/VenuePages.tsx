import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, MapPin, Users } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { venues } from '../data/mock';

export function VenueListPage() {
  const [capacity, setCapacity] = useState('Any capacity');
  const [location, setLocation] = useState('All locations');
  const [facilities, setFacilities] = useState<string[]>([]);
  const [availability, setAvailability] = useState('Any date');
  const [sort, setSort] = useState('Recommended');
  const filtered = useMemo(() => {
    const matches = venues.filter((venue) => {
      const capacityMatch = capacity === 'Any capacity' || (capacity === 'Under 100' ? venue.capacity < 100 : venue.capacity >= 100);
      const locationMatch = location === 'All locations' || venue.location === location;
      const facilityMatch = facilities.every((facility) => facility === 'Outdoor space'
        ? venue.kind === 'Outdoor space'
        : venue.facilities.some((item) => item.toLowerCase() === facility.toLowerCase()));
      const availabilityMatch = availability === 'Any date' || venue.availabilityTags.includes(availability);
      return capacityMatch && locationMatch && facilityMatch && availabilityMatch;
    });
    return matches.sort((a, b) => sort === 'Largest capacity' ? b.capacity - a.capacity : sort === 'Smallest capacity' ? a.capacity - b.capacity : 0);
  }, [capacity, location, facilities, availability, sort]);

  return (
    <div className="page-wrap listing-page">
      <div className="page-heading"><span className="eyebrow">SPACE FOR YOUR NEXT IDEA</span><h1>Find a venue</h1><p>Search and book suitable spaces for your campus event.</p></div>
      <div className="venue-search-bar"><span className="venue-search-mark"><MapPin size={19} /></span><div><strong>Find your space</strong><small>Capacity, facilities, and availability to fit your plans.</small></div><Link className="button button--primary" to="/venues/great-hall">Explore venues <ArrowRight size={16} /></Link></div>
      <div className="listing-layout venue-listing-layout">
        <aside className="filter-panel" aria-label="Venue filters">
          <div className="filter-panel-head"><strong>Filters</strong><button type="button" className="text-button" onClick={() => { setCapacity('Any capacity'); setLocation('All locations'); setFacilities([]); setAvailability('Any date'); setSort('Recommended'); }}>Clear all</button></div>
          <div className="filter-group"><label htmlFor="capacity-filter">Capacity</label><select id="capacity-filter" value={capacity} onChange={(event) => setCapacity(event.target.value)}><option>Any capacity</option><option>Under 100</option><option>100 or more</option></select></div>
          <div className="filter-group"><label htmlFor="venue-location-filter">Location</label><select id="venue-location-filter" value={location} onChange={(event) => setLocation(event.target.value)}><option>All locations</option><option>Main Campus</option><option>Learning Commons</option><option>Central Campus</option></select></div>
          <fieldset className="filter-group"><legend>Facilities</legend>{['Projector', 'Sound system', 'Wi-Fi', 'Outdoor space'].map((facility) => <label className="check-row" key={facility}><input type="checkbox" checked={facilities.includes(facility)} onChange={() => setFacilities((current) => current.includes(facility) ? current.filter((item) => item !== facility) : [...current, facility])} />{facility}</label>)}</fieldset>
          <div className="filter-group"><label htmlFor="venue-availability-filter">Availability</label><select id="venue-availability-filter" value={availability} onChange={(event) => setAvailability(event.target.value)}><option>Any date</option><option>Today</option><option>This week</option></select></div>
        </aside>
        <section className="results-panel" aria-labelledby="venue-results-title">
          <div className="results-toolbar"><div className="results-toolbar-label"><span className="eyebrow">CAMPUS SPACES</span><strong id="venue-results-title">{filtered.length} venues available</strong></div><label className="sort-select"><span className="sr-only">Sort venues</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Recommended</option><option>Largest capacity</option><option>Smallest capacity</option></select></label></div>
          <div className="venue-grid">{filtered.map((venue) => <article className="venue-card" key={venue.id}><Link to={`/venues/${venue.id}`} className="venue-card-image-link" aria-label={`View ${venue.name}`}><img src={venue.image} alt={`${venue.name} campus venue`} loading="lazy" /><span className="venue-image-badge">{venue.kind}</span></Link><div className="venue-card-body"><div className="venue-card-title-row"><div><h2><Link to={`/venues/${venue.id}`}>{venue.name}</Link></h2><span className="muted meta-with-icon"><MapPin size={14} />{venue.location}</span></div><span className="capacity-pill"><Users size={14} />{venue.capacity}</span></div><div className="facility-tags">{venue.facilities.slice(0, 3).map((facility) => <span key={facility}>{facility}</span>)}</div><p>{venue.description}</p><Link className="button button--outline button--full" to={`/venues/${venue.id}`}>View venue <ArrowRight size={15} /></Link></div></article>)}</div>
          {filtered.length === 0 && <div className="empty-state"><h2>No matching spaces</h2><p>Try widening your venue filters.</p></div>}
        </section>
      </div>
    </div>
  );
}

export function VenueDetailsPage() {
  const { id } = useParams();
  const venue = venues.find((item) => item.id === id);
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedDay, setSelectedDay] = useState(12);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(2026, 3, 1));
  const navigate = useNavigate();
  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const selectedDate = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const moveCalendarMonth = (offset: number) => {
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    setCalendarMonth(nextMonth);
    setSelectedDay((day) => Math.min(day, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
    setSelectedSlot('');
  };

  if (!venue) return <div className="page-wrap"><div className="empty-state"><h2>Venue not found</h2><Link className="button button--primary" to="/venues">Browse venues</Link></div></div>;

  return (
    <div className="page-wrap venue-detail-page">
      <Link className="back-link" to="/venues">← Back to venues</Link>
      <section className="venue-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(15,22,50,.76), rgba(15,22,50,.08)), url("${venue.image}")` }}>
        <div><span className="tag tag--white">{venue.kind}</span><h1>{venue.name}</h1><p className="meta-with-icon"><MapPin size={15} />{venue.location}</p><div className="venue-hero-facts"><span><Users size={15} />Capacity {venue.capacity}</span>{venue.facilities.slice(0, 3).map((facility) => <span key={facility}><span className="venue-facility-dot" />{facility}</span>)}</div></div>
      </section>
      <section className="venue-photo-row" aria-label="Venue photos"><img src={venue.image} alt={`${venue.name} view`} /><img src="/assets/event-innovation.jpg" alt="Campus event space set up for a student workshop" /><img src="/assets/campus-courtyard.jpg" alt="Outdoor campus gathering space" /></section>
      <div className="venue-detail-content">
        <div className="venue-detail-main">
          <div className="detail-tabs" role="tablist" aria-label="Venue information">{['Overview', 'Availability', 'Facilities', 'Location'].map((tab) => <button id={`venue-tab-${tab.toLowerCase()}`} aria-controls={`venue-panel-${tab.toLowerCase()}`} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'detail-tab detail-tab--active' : 'detail-tab'} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div>
          <div className="tab-content" id="venue-panel-overview" role="tabpanel" aria-labelledby="venue-tab-overview" tabIndex={0} hidden={activeTab !== 'Overview'}><h2>A space to bring people together.</h2><p>{venue.description} Located at {venue.location.toLowerCase()}, the venue offers easy access and space for everything from meetings to major campus events.</p><button className="text-link" type="button" onClick={() => setActiveTab('Facilities')}>See all facilities <ArrowRight size={15} /></button></div>
          <div className="tab-content" id="venue-panel-availability" role="tabpanel" aria-labelledby="venue-tab-availability" tabIndex={0} hidden={activeTab !== 'Availability'}><h2>Availability at a glance</h2><p>Select a date and a time below to prepare a booking request.</p></div>
          <div className="tab-content" id="venue-panel-facilities" role="tabpanel" aria-labelledby="venue-tab-facilities" tabIndex={0} hidden={activeTab !== 'Facilities'}><h2>Everything you need</h2><ul className="facility-list">{venue.facilities.map((facility) => <li key={facility}><Check size={15} />{facility}</li>)}</ul></div>
          <div className="tab-content" id="venue-panel-location" role="tabpanel" aria-labelledby="venue-tab-location" tabIndex={0} hidden={activeTab !== 'Location'}><h2>{venue.location}</h2><p>Follow campus wayfinding signs to the main entrance. Accessibility routes are available.</p></div>
          <div className="availability-box" id="availability">
            <div><span className="eyebrow">CHECK AVAILABILITY</span><h2>Choose your time</h2></div>
            <div className="availability-controls">
              <div className="mini-calendar">
                <div className="calendar-month"><button type="button" aria-label="Previous month" onClick={() => moveCalendarMonth(-1)}>‹</button><strong>{monthLabel}</strong><button type="button" aria-label="Next month" onClick={() => moveCalendarMonth(1)}>›</button></div>
                <div className="calendar-grid calendar-grid--days">{['S','M','T','W','T','F','S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
                <div className="calendar-grid">
                  {Array.from({ length: firstWeekday }, (_, index) => <span aria-hidden="true" key={`empty-${index}`} />)}
                  {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => <button className={selectedDay === day ? 'calendar-day calendar-day--selected' : 'calendar-day'} type="button" onClick={() => { setSelectedDay(day); setSelectedSlot(''); }} key={day} aria-pressed={selectedDay === day} aria-label={`${monthLabel} ${day}`}>{day}</button>)}
                </div>
              </div>
              <div className="time-slots"><strong>Available time slots</strong><p>{monthLabel} {selectedDay}</p>{venue.available.map((slot) => <button type="button" aria-pressed={selectedSlot === slot} className={selectedSlot === slot ? 'time-slot time-slot--selected' : 'time-slot'} onClick={() => setSelectedSlot(slot)} key={slot}><Clock3 size={14} />{slot}<span>{selectedSlot === slot ? 'Selected' : 'Available'}</span></button>)}<p className="muted" id="availability-note">{selectedSlot ? 'Your selected slot will be carried into the booking draft.' : 'Select an available time slot to continue.'}</p><button className="button button--primary button--full" type="button" disabled={!selectedSlot} onClick={() => navigate(`/booking/new?venue=${venue.id}&date=${selectedDate}&slot=${encodeURIComponent(selectedSlot)}`)}>Book Now <ArrowRight size={16} /></button></div>
            </div>
          </div>
        </div>
        <aside className="venue-aside-card"><span className="eyebrow">VENUE DETAILS</span><h3>{venue.name}</h3><p className="meta-with-icon"><MapPin size={15} />{venue.location}</p><p className="meta-with-icon"><Users size={15} />Up to {venue.capacity} people</p><hr /><strong>Popular facilities</strong><div className="facility-tags">{venue.facilities.slice(0, 4).map((facility) => <span key={facility}>{facility}</span>)}</div><a className="button button--primary button--full" href="#availability">Choose a time <ArrowRight size={15} /></a></aside>
      </div>
    </div>
  );
}

type BookingFormState = { eventName: string; date: string; startTime: string; endTime: string; attendance: string; purpose: string; additional: string };

function timeToMinutes(value: string) {
  const [clock, period] = value.split(' ');
  const [hours, minutes] = clock.split(':').map(Number);
  return ((hours % 12) + (period === 'PM' ? 12 : 0)) * 60 + minutes;
}

export function BookingPage() {
  const [params] = useSearchParams();
  const venue = venues.find((item) => item.id === params.get('venue')) ?? venues[0];
  const initialDate = params.get('date') ?? '';
  const initialSlot = params.get('slot') ?? '';
  const [selectedSlot, setSelectedSlot] = useState(() => venue.available.includes(initialSlot) ? initialSlot : '');
  const [form, setForm] = useState<BookingFormState>(() => {
    const [startTime = '', endTime = ''] = venue.available.includes(initialSlot) ? initialSlot.split(' – ') : [];
    return { eventName: '', date: initialDate, startTime, endTime, attendance: '', purpose: '', additional: '' };
  });
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const update = (key: keyof BookingFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const startTimes = Array.from(new Set(venue.available.map((slot) => slot.split(' – ')[0])));
  const endTimes = Array.from(new Set(venue.available.map((slot) => slot.split(' – ')[1])));
  const chooseSlot = (slot: string) => {
    const [startTime = '', endTime = ''] = slot.split(' – ');
    setSelectedSlot(slot);
    setForm((current) => ({ ...current, startTime, endTime }));
  };
  const updateTime = (key: 'startTime' | 'endTime', value: string) => {
    const nextForm = { ...form, [key]: value };
    setForm((current) => ({ ...current, [key]: value }));
    const matchedSlot = venue.available.find((slot) => slot === `${nextForm.startTime} – ${nextForm.endTime}`);
    setSelectedSlot(matchedSlot ?? '');
  };

  const continueStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (step === 1 && (!form.eventName.trim() || !form.date || !form.startTime || !form.endTime)) {
      setError('Please complete the event name, date, and both times to continue.');
      return;
    }
    if (step === 1 && (!selectedSlot || !venue.available.includes(selectedSlot) || selectedSlot !== `${form.startTime} – ${form.endTime}`)) {
      setError('Choose one of this venue’s available time slots to continue.');
      return;
    }
    if (step === 1 && timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      setError('End time must be later than start time.');
      return;
    }
    const attendance = Number(form.attendance);
    if (step === 2 && (!Number.isInteger(attendance) || attendance < 1 || attendance > venue.capacity || !form.purpose)) {
      setError(`Enter attendance from 1 to ${venue.capacity} and choose a purpose to continue.`);
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  if (submitted) return <div className="page-wrap booking-page"><div className="booking-success"><span className="success-mark"><Check size={30} /></span><span className="eyebrow">DEMO COMPLETE</span><h1>Your booking draft is ready.</h1><p>This frontend demo has not submitted or reserved a real venue. Your details are only shown in this temporary preview.</p><div className="success-summary"><strong>{form.eventName}</strong><span>{venue.name} · {form.date}</span><span>{form.startTime} – {form.endTime}</span></div><div className="success-actions"><Link className="button button--primary" to="/student/dashboard">View dashboard</Link><Link className="button button--outline" to="/venues">Find another venue</Link></div></div></div>;

  return (
    <div className="page-wrap booking-page">
      <div className="booking-head"><Link className="back-link" to={`/venues/${venue.id}`}><ArrowLeft size={15} /> Back to {venue.name}</Link><span className="eyebrow">VENUE REQUEST · FRONTEND DEMO</span><h1>Book {venue.name}</h1><p>Share a few details about your event to prepare a booking draft.</p></div>
      <div className="booking-card">
        <div className="booking-steps" aria-label="Booking steps">{[['1','Details'],['2','Attendees'],['3','Review']].map(([number, label]) => <div className={step >= Number(number) ? 'booking-step booking-step--active' : 'booking-step'} key={number}><span>{step > Number(number) ? <Check size={14} /> : number}</span><strong>{label}</strong></div>)}</div>
        <form onSubmit={continueStep} noValidate>
          {step === 1 && <div className="booking-form-section"><div className="form-section-heading"><span className="eyebrow">STEP 1 OF 3</span><h2>Tell us about your event</h2><p>Start with the essentials.</p></div><div className="form-grid"><div className="form-field form-field--full"><label htmlFor="booking-event-name">Event name</label><input id="booking-event-name" required value={form.eventName} onChange={(event) => update('eventName', event.target.value)} placeholder="e.g. Student Innovation Night" /></div><div className="form-field form-field--full"><label htmlFor="booking-date">Event date</label><input id="booking-date" type="date" required value={form.date} onChange={(event) => update('date', event.target.value)} /></div><div className="form-field form-field--full"><label htmlFor="booking-slot">Available time slot</label><select id="booking-slot" value={selectedSlot} onChange={(event) => chooseSlot(event.target.value)}><option value="">Choose an available slot</option>{venue.available.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></div><div className="form-field"><label htmlFor="booking-start">Start time</label><select id="booking-start" value={form.startTime} onChange={(event) => updateTime('startTime', event.target.value)}><option value="">Select time</option>{startTimes.map((time) => <option key={time}>{time}</option>)}</select></div><div className="form-field"><label htmlFor="booking-end">End time</label><select id="booking-end" value={form.endTime} onChange={(event) => updateTime('endTime', event.target.value)}><option value="">Select time</option>{endTimes.map((time) => <option key={time}>{time}</option>)}</select></div></div></div>}
          {step === 2 && <div className="booking-form-section"><div className="form-section-heading"><span className="eyebrow">STEP 2 OF 3</span><h2>Plan for your attendees</h2><p>Help us understand the kind of gathering you have in mind.</p></div><div className="form-grid"><div className="form-field"><label htmlFor="booking-attendance">Expected attendance</label><input id="booking-attendance" type="number" min="1" max={venue.capacity} value={form.attendance} onChange={(event) => update('attendance', event.target.value)} placeholder={`Up to ${venue.capacity}`} /></div><div className="form-field"><label htmlFor="booking-purpose">Purpose of booking</label><select id="booking-purpose" value={form.purpose} onChange={(event) => update('purpose', event.target.value)}><option value="">Select purpose</option><option>Workshop</option><option>Club meeting</option><option>Conference</option><option>Social event</option><option>Other campus event</option></select></div><div className="form-field form-field--full"><label htmlFor="booking-notes">Additional information <span className="muted">(optional)</span></label><textarea id="booking-notes" rows={4} value={form.additional} onChange={(event) => update('additional', event.target.value)} placeholder="Share any setup or accessibility notes." /></div></div></div>}
          {step === 3 && <div className="booking-form-section"><div className="form-section-heading"><span className="eyebrow">STEP 3 OF 3</span><h2>Review your booking draft</h2><p>Check your details. You decide whether to confirm this mock request.</p></div><div className="review-card"><div><span>Event name</span><strong>{form.eventName}</strong></div><div><span>Venue</span><strong>{venue.name} · {venue.location}</strong></div><div><span>Date and time</span><strong>{form.date} · {form.startTime} – {form.endTime}</strong></div><div><span>Attendance</span><strong>{form.attendance} people</strong></div><div><span>Purpose</span><strong>{form.purpose}</strong></div>{form.additional && <div><span>Additional information</span><strong>{form.additional}</strong></div>}</div><p className="demo-notice"><span>i</span>This action only completes a local frontend demo; it does not contact the university or reserve the venue.</p></div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="booking-form-actions">{step > 1 ? <button type="button" className="button button--outline" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</button> : <button type="button" className="button button--outline" onClick={() => navigate(`/venues/${venue.id}`)}>Cancel</button>}{step < 3 ? <button className="button button--primary" type="submit">Continue <ArrowRight size={16} /></button> : <button className="button button--primary" type="button" onClick={() => setSubmitted(true)}>Confirm mock booking <Check size={16} /></button>}</div>
        </form>
      </div>
      <div className="booking-footnote"><CalendarDays size={17} /><span><strong>{venue.name}</strong><br />Capacity {venue.capacity} · {venue.location}</span><span className="footnote-slot"><Clock3 size={15} />{selectedSlot || 'Select a time'}</span></div>
    </div>
  );
}
