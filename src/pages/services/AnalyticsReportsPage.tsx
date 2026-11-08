import { useEffect, useState } from 'react';
import { ArrowUpRight, BarChart3, CalendarDays, TicketCheck, UsersRound } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getBookingAnalytics } from '../../api/admin';
import { listCampusEvents } from '../../api/events';
import type { ApiBookingAnalytics, ApiCampusEvent } from '../../api/types';
import { StatusMessage, ServicePageHeading, WorkspacePanel } from './shared';

function tone(index: number) { return ['blue', 'violet', 'mint', 'amber'][index % 4]; }

export function AnalyticsReportsPage() {
  const [events, setEvents] = useState<ApiCampusEvent[]>([]);
  const [booking, setBooking] = useState<ApiBookingAnalytics | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([
      listCampusEvents().catch(() => [] as ApiCampusEvent[]),
      getBookingAnalytics().catch((e: unknown) => { setNotice(e instanceof ApiError ? `Booking analytics unavailable: ${e.message}` : 'Booking analytics unavailable.'); return null; }),
    ]).then(([e, b]) => { setEvents(e); setBooking(b); });
  }, []);

  const registrations = events.reduce((n, e) => n + e.confirmed_registrations, 0);
  const metrics = [
    { label: 'Published Events', value: String(events.length), trend: 'Live count', icon: CalendarDays, t: tone(0) },
    { label: 'Event Registrations', value: String(registrations), trend: 'Across published events', icon: TicketCheck, t: tone(1) },
    { label: 'Bookings', value: String(booking?.total_bookings ?? 0), trend: 'Booking analytics', icon: BarChart3, t: tone(2) },
    { label: 'Approved Bookings', value: String(booking?.confirmed_bookings ?? 0), trend: 'Booking analytics', icon: UsersRound, t: tone(3) },
  ];
  const venues = (booking?.venue_usage ?? []).slice(0, 5);
  const maxVenue = Math.max(1, ...venues.map((v) => v.booking_count));

  return (
    <section className="sd-page sd-analytics-page">
      <ServicePageHeading title="Analytics & Reports" description="Live event and booking analytics where available." />
      <div className="sd-metric-grid">
        {metrics.map(({ label, value, trend, icon: Icon, t }) => <article className={`sd-metric-card sd-metric-card--${t}`} key={label}><span className="sd-metric-icon"><Icon size={18} aria-hidden="true" /></span><span className="sd-metric-label">{label}</span><strong>{value}</strong><small><ArrowUpRight size={12} aria-hidden="true" />{trend}</small></article>)}
      </div>
      <div className="sd-analytics-lower-grid">
        <WorkspacePanel title="Top Venues" titleId="analytics-venues-title"><ul className="sd-venue-bars">{venues.map((venue) => <li key={venue.venue_id}><span>{venue.venue_name}</span><div><i style={{ width: `${(venue.booking_count / maxVenue) * 100}%` }} /></div><b>{venue.booking_count}</b></li>)}{venues.length === 0 && <li>No booking analytics available.</li>}</ul></WorkspacePanel>
        <WorkspacePanel title="Published Events" titleId="analytics-events-title"><ul className="sd-activity-list">{events.slice(0, 8).map((event) => <li key={event.id}><span><CalendarDays size={15} aria-hidden="true" /></span><div><strong>{event.title}</strong><small>{event.confirmed_registrations}/{event.capacity} registered · {event.status}</small></div></li>)}{events.length === 0 && <li>No published events.</li>}</ul></WorkspacePanel>
      </div>
      <StatusMessage tone={notice ? 'warning' : 'info'}>{notice || 'Event counts are live. Booking analytics require an authorized admin session.'}</StatusMessage>
    </section>
  );
}
