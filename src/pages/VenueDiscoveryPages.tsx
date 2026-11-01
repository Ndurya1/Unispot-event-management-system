import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getVenue, listFacilities, listVenues, searchAvailability } from '../api/venues';
import type { ApiVenue, Facility } from '../api/types';
import { useAuth } from '../auth/AuthProvider';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toCampusDateTime(date: string, time: string) {
  return `${date}T${time}:00+03:00`;
}

export function VenueListPage() {
  const [capacity, setCapacity] = useState('');
  const [location, setLocation] = useState('');
  const [facilities, setFacilities] = useState<string[]>([]);
  const [sort, setSort] = useState('Recommended');
  const [venueData, setVenueData] = useState<ApiVenue[]>([]);
  const [facilityData, setFacilityData] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');
    Promise.all([
      listVenues({
        capacity: capacity === '100 or more' ? 100 : undefined,
        location: location || undefined,
        facilityId: facilities[0],
        limit: 100,
      }),
      listFacilities(),
    ]).then(([venues, catalog]) => {
      if (!active) return;
      setVenueData(venues);
      setFacilityData(catalog);
    }).catch((requestError: unknown) => {
      if (active) setError(errorMessage(requestError, 'Venue data could not be loaded.'));
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [capacity, location, facilities]);

  const filteredVenues = useMemo(() => {
    const matches = venueData.filter((venue) => {
      const capacityMatch = capacity !== 'Under 100' || venue.capacity < 100;
      const selectedFacilities = facilities.map((id) => facilityData.find((item) => item.id === id)?.name);
      const facilityMatch = selectedFacilities.every((name) => !name || venue.facilities.some((item) => item.name === name));
      return capacityMatch && facilityMatch;
    });
    return [...matches].sort((a, b) => sort === 'Largest capacity'
      ? b.capacity - a.capacity
      : sort === 'Smallest capacity'
        ? a.capacity - b.capacity
        : a.name.localeCompare(b.name));
  }, [capacity, facilities, facilityData, sort, venueData]);

  const clearFilters = () => {
    setCapacity('');
    setLocation('');
    setFacilities([]);
    setSort('Recommended');
  };

  return (
    <div className="page-wrap listing-page">
      <div className="page-heading"><span className="eyebrow">SPACE FOR YOUR NEXT IDEA</span><h1>Find a venue</h1><p>Search live venue metadata from the UniSpot backend.</p></div>
      <div className="venue-search-bar"><span className="venue-search-mark"><MapPin size={19} /></span><div><strong>Find your space</strong><small>Capacity, facilities, and location from the campus venue catalog.</small></div><Link className="button button--primary" to="/venues">Browse venues <ArrowRight size={16} /></Link></div>
      <div className="listing-layout venue-listing-layout">
        <aside className="filter-panel" aria-label="Venue filters">
          <div className="filter-panel-head"><strong>Filters</strong><button type="button" className="text-button" onClick={clearFilters}>Clear all</button></div>
          <div className="filter-group"><label htmlFor="capacity-filter">Capacity</label><select id="capacity-filter" value={capacity} onChange={(event) => setCapacity(event.target.value)}><option value="">Any capacity</option><option>Under 100</option><option>100 or more</option></select></div>
          <div className="filter-group"><label htmlFor="venue-location-filter">Location</label><select id="venue-location-filter" value={location} onChange={(event) => setLocation(event.target.value)}><option value="">All locations</option><option>Main Campus</option><option>Learning Commons</option><option>Central Campus</option></select></div>
          <fieldset className="filter-group"><legend>Facilities</legend>{facilityData.map((facility) => <label className="check-row" key={facility.id}><input type="checkbox" checked={facilities.includes(facility.id)} onChange={() => setFacilities((current) => current.includes(facility.id) ? current.filter((item) => item !== facility.id) : [...current, facility.id])} />{facility.name}</label>)}</fieldset>
        </aside>
        <section className="results-panel" aria-labelledby="venue-results-title">
          <div className="results-toolbar"><div className="results-toolbar-label"><span className="eyebrow">CAMPUS SPACES</span><strong id="venue-results-title">{isLoading ? 'Loading venues…' : `${filteredVenues.length} venues available`}</strong></div><label className="sort-select"><span className="sr-only">Sort venues</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Recommended</option><option>Largest capacity</option><option>Smallest capacity</option></select></label></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!isLoading && !error && <div className="venue-grid">{filteredVenues.map((venue) => <article className="venue-card" key={venue.id}><Link to={`/venues/${venue.id}`} className="venue-card-image-link" aria-label={`View ${venue.name}`}>{venue.image_url ? <img src={venue.image_url} alt={`${venue.name} campus venue`} loading="lazy" /> : <span className="empty-state">No venue image</span>}<span className="venue-image-badge">{venue.venue_type}</span></Link><div className="venue-card-body"><div className="venue-card-title-row"><div><h2><Link to={`/venues/${venue.id}`}>{venue.name}</Link></h2><span className="muted meta-with-icon"><MapPin size={14} />{venue.location}</span></div><span className="capacity-pill"><Users size={14} />{venue.capacity}</span></div><div className="facility-tags">{venue.facilities.slice(0, 3).map((facility) => <span key={facility.id}>{facility.name}</span>)}</div><p>{venue.description || 'Venue details are available from the campus catalog.'}</p><Link className="button button--outline button--full" to={`/venues/${venue.id}`}>View venue <ArrowRight size={15} /></Link></div></article>)}</div>}
          {!isLoading && !error && filteredVenues.length === 0 && <div className="empty-state"><h2>No matching spaces</h2><p>Try widening your venue filters.</p></div>}
        </section>
      </div>
    </div>
  );
}

export function VenueDetailsPage() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<ApiVenue | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [availabilityMessage, setAvailabilityMessage] = useState('Select a time to check this venue.');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!id) return () => { active = false; };
    getVenue(id).then((result) => {
      if (active) setVenue(result);
    }).catch((requestError: unknown) => {
      if (active) setError(errorMessage(requestError, 'Venue details could not be loaded.'));
    });
    return () => { active = false; };
  }, [id]);

  const checkAvailability = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!venue || !isAuthenticated) {
      setAvailabilityMessage('Sign in to check live availability for this venue.');
      return;
    }
    if (endTime <= startTime) {
      setAvailabilityMessage('End time must be later than start time.');
      setIsAvailable(false);
      return;
    }
    setIsChecking(true);
    setError('');
    try {
      const availableVenues = await searchAvailability({
        startsAt: toCampusDateTime(date, startTime),
        endsAt: toCampusDateTime(date, endTime),
        capacity: 1,
        location: venue.location,
        limit: 100,
      });
      const available = availableVenues.some((item) => item.id === venue.id);
      setIsAvailable(available);
      setAvailabilityMessage(available ? 'This venue is available for the selected time.' : 'This venue is not available for the selected time.');
    } catch (requestError) {
      setIsAvailable(false);
      setError(errorMessage(requestError, 'Availability could not be checked.'));
    } finally {
      setIsChecking(false);
    }
  };

  if (error && !venue) return <div className="page-wrap"><div className="empty-state"><h2>Venue unavailable</h2><p>{error}</p><Link className="button button--primary" to="/venues">Browse venues</Link></div></div>;
  if (!venue) return <div className="page-wrap"><div className="empty-state"><h2>Loading venue…</h2></div></div>;

  return (
    <div className="page-wrap venue-detail-page">
      <Link className="back-link" to="/venues"><ArrowLeft size={15} /> Back to venues</Link>
      <section className="venue-hero" style={venue.image_url ? { backgroundImage: `linear-gradient(90deg, rgba(15,22,50,.76), rgba(15,22,50,.08)), url("${venue.image_url}")` } : undefined}>
        <div><span className="tag tag--white">{venue.venue_type}</span><h1>{venue.name}</h1><p className="meta-with-icon"><MapPin size={15} />{venue.location}</p><div className="venue-hero-facts"><span><Users size={15} />Capacity {venue.capacity}</span>{venue.facilities.slice(0, 3).map((facility) => <span key={facility.id}><span className="venue-facility-dot" />{facility.name}</span>)}</div></div>
      </section>
      {venue.image_url && <section className="venue-photo-row" aria-label="Venue photo"><img src={venue.image_url} alt={`${venue.name} view`} /></section>}
      <div className="venue-detail-content">
        <div className="venue-detail-main">
          <div className="detail-tabs" role="tablist" aria-label="Venue information">{['Overview', 'Availability', 'Facilities', 'Location'].map((tab) => <button id={`venue-tab-${tab.toLowerCase()}`} aria-controls={`venue-panel-${tab.toLowerCase()}`} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'detail-tab detail-tab--active' : 'detail-tab'} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div>
          <div className="tab-content" id="venue-panel-overview" role="tabpanel" hidden={activeTab !== 'Overview'}><h2>A space to bring people together.</h2><p>{venue.description || 'This venue is ready for campus events.'} Located at {venue.location.toLowerCase()}.</p><button className="text-link" type="button" onClick={() => setActiveTab('Facilities')}>See all facilities <ArrowRight size={15} /></button></div>
          <div className="tab-content" id="venue-panel-availability" role="tabpanel" hidden={activeTab !== 'Availability'}><h2>Availability at a glance</h2><p>Choose a date and time to query the live availability service.</p></div>
          <div className="tab-content" id="venue-panel-facilities" role="tabpanel" hidden={activeTab !== 'Facilities'}><h2>Everything you need</h2><ul className="facility-list">{venue.facilities.map((facility) => <li key={facility.id}><Check size={15} />{facility.name}</li>)}</ul></div>
          <div className="tab-content" id="venue-panel-location" role="tabpanel" hidden={activeTab !== 'Location'}><h2>{venue.location}</h2><p>Follow campus wayfinding signs to the venue entrance. Accessibility routes are available.</p></div>
          <div className="availability-box" id="availability"><div><span className="eyebrow">CHECK AVAILABILITY</span><h2>Choose your time</h2></div><form className="availability-controls" onSubmit={checkAvailability}><div className="form-field"><label htmlFor="venue-date">Date</label><input id="venue-date" type="date" value={date} min={formatDate(new Date())} onChange={(event) => setDate(event.target.value)} /></div><div className="form-field"><label htmlFor="venue-start">Starts</label><input id="venue-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div><div className="form-field"><label htmlFor="venue-end">Ends</label><input id="venue-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div><button className="button button--primary" type="submit" disabled={isChecking}>{isChecking ? 'Checking…' : 'Check availability'} <Clock3 size={15} /></button><p className="muted" role="status">{availabilityMessage}</p>{error && <p className="form-error" role="alert">{error}</p>}{isAvailable && <button className="button button--outline" type="button" onClick={() => navigate(`/booking/new?venue=${venue.id}&date=${date}&slot=${encodeURIComponent(`${startTime} – ${endTime}`)}`)}>Continue to booking <ArrowRight size={16} /></button>}</form></div>
        </div>
        <aside className="venue-aside-card"><span className="eyebrow">VENUE DETAILS</span><h3>{venue.name}</h3><p className="meta-with-icon"><MapPin size={15} />{venue.location}</p><p className="meta-with-icon"><Users size={15} />Up to {venue.capacity} people</p><hr /><strong>Popular facilities</strong><div className="facility-tags">{venue.facilities.slice(0, 4).map((facility) => <span key={facility.id}>{facility.name}</span>)}</div><a className="button button--primary button--full" href="#availability">Choose a time <ArrowRight size={15} /></a></aside>
      </div>
    </div>
  );
}
