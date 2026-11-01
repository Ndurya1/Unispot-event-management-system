import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Bell, Building2, CalendarCheck, CalendarDays, ChartNoAxesColumn, CircleUserRound, ClipboardCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminKpis } from '../../data/adminMock';
import { getBookingAnalytics } from '../../api/admin';
import type { ApiBookingAnalytics } from '../../api/types';
import { AdminMetric, AdminPageHeader, AdminPanel } from './shared';

const metricIcons = [Users, CalendarDays, CalendarCheck, Activity];
const activity = [
  { title: 'New event registration', detail: 'Tech Talk Series · 2 min ago', icon: ClipboardCheck },
  { title: 'Venue booking request', detail: 'Great Hall · 12 min ago', icon: CalendarCheck },
  { title: 'New user registered', detail: 'Mary Wanjiru · Student · 18 min ago', icon: CircleUserRound },
  { title: 'Provider approved', detail: 'Royal Catering Services · 31 min ago', icon: Building2 },
];
const venues = [
  { name: 'Great Hall', value: 42, color: '#5146f6' },
  { name: 'Seminar Room A', value: 26, color: '#3d88e8' },
  { name: 'Auditorium', value: 18, color: '#27b39a' },
  { name: 'Conference Room', value: 14, color: '#8b69dc' },
];

export function AdminDashboardPage() {
  const [period, setPeriod] = useState('Last 30 Days');
  const [analytics, setAnalytics] = useState<ApiBookingAnalytics | null>(null);
  useEffect(() => { void getBookingAnalytics().then(setAnalytics).catch(() => undefined); }, []);
  const dashboardKpis = analytics ? [
    adminKpis[0],
    adminKpis[1],
    { label: 'Total Bookings', value: String(analytics.total_bookings), trend: 'Live', tone: 'mint' },
    { label: 'Expected Attendance', value: String(analytics.total_expected_attendance), trend: 'Live', tone: 'amber' },
  ] : adminKpis;
  const popularVenues = analytics?.venue_usage.slice(0, 4).map((venue, index) => ({ name: venue.venue_name, value: venue.booking_count, color: ['#5146f6', '#3d88e8', '#27b39a', '#8b69dc'][index] })) ?? venues;
  return (
    <section className="admin-dashboard-page">
      <AdminPageHeader title="Dashboard" description="Overview of your UniSpot campus platform." eyebrow="PLATFORM OVERVIEW" action={<label className="admin-period-select"><CalendarDays size={15} aria-hidden="true" /><span className="sr-only">Dashboard period</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Last 30 Days</option><option>Last 90 Days</option><option>This Semester</option></select></label>} />
      <div className="admin-kpi-grid" aria-label={`Platform metrics for ${period}`}>
        {dashboardKpis.map((metric, index) => <AdminMetric key={metric.label} {...metric} icon={metricIcons[index]} />)}
      </div>

      <div className="admin-dashboard-grid">
        <AdminPanel title="Event Registrations Trend" className="admin-trend-panel" action={<label className="admin-small-select"><span className="sr-only">Trend chart period</span><select defaultValue="This Month"><option>This Month</option><option>This Semester</option></select></label>}>
          <div className="admin-chart-summary"><span>Registrations <strong>684</strong></span><span className="admin-trend-positive">↗ 18% vs. last period</span></div>
          <figure className="admin-line-chart"><svg viewBox="0 0 640 220" role="img" aria-labelledby="admin-trend-title admin-trend-desc" preserveAspectRatio="none"><title id="admin-trend-title">Campus event registrations trend</title><desc id="admin-trend-desc">A sample line chart showing an overall rise in registrations between September and October.</desc><g className="admin-grid-lines"><line x1="42" y1="25" x2="626" y2="25" /><line x1="42" y1="72" x2="626" y2="72" /><line x1="42" y1="119" x2="626" y2="119" /><line x1="42" y1="166" x2="626" y2="166" /></g><g className="admin-y-labels"><text x="4" y="29">200</text><text x="4" y="76">150</text><text x="4" y="123">100</text><text x="10" y="170">50</text><text x="18" y="208">0</text></g><path className="admin-chart-area" d="M42 155 L97 163 L151 142 L205 151 L260 112 L314 126 L369 91 L423 119 L478 77 L532 93 L586 55 L626 30 L626 190 L42 190Z" /><polyline className="admin-chart-line" points="42,155 97,163 151,142 205,151 260,112 314,126 369,91 423,119 478,77 532,93 586,55 626,30" /><g className="admin-chart-dots"><circle cx="42" cy="155" r="3" /><circle cx="151" cy="142" r="3" /><circle cx="260" cy="112" r="3" /><circle cx="369" cy="91" r="3" /><circle cx="478" cy="77" r="3" /><circle cx="586" cy="55" r="3" /><circle cx="626" cy="30" r="3" /></g></svg><figcaption><span>Sep 15</span><span>Sep 18</span><span>Sep 21</span><span>Sep 24</span><span>Sep 27</span><span>Sep 30</span><span>Oct 03</span><span>Oct 06</span><span>Oct 09</span></figcaption></figure>
        </AdminPanel>

        <AdminPanel title="Popular Venues" action={<Link className="admin-panel-link" to="/admin/venues">View all <ArrowRight size={13} /></Link>}>
          <div className="admin-popular-venues"><div className="admin-donut" role="img" aria-label="Booking counts by venue from the live admin analytics response"><span>Bookings<small>by venue</small></span></div><ul>{popularVenues.map((venue) => <li key={venue.name}><i style={{ background: venue.color }} /><span>{venue.name}</span><strong>{venue.value}</strong></li>)}</ul></div>
        </AdminPanel>

        <AdminPanel title="Recent Activity" action={<Link className="admin-panel-link" to="/admin/audit-logs">View all <ArrowRight size={13} /></Link>}>
          <ul className="admin-activity-list">{activity.map(({ title, detail, icon: Icon }) => <li key={title}><span className="admin-activity-icon"><Icon size={14} aria-hidden="true" /></span><span><strong>{title}</strong><small>{detail}</small></span></li>)}</ul>
        </AdminPanel>
      </div>

      <div className="admin-dashboard-bottom">
        <section className="admin-announcement"><span className="admin-announcement-icon"><Bell size={21} aria-hidden="true" /></span><div><strong>System Announcement</strong><p>The platform will be under maintenance on 12th October 2026 from 8:00 AM–12:00 PM.</p></div><Link className="button button--primary button--small" to="/admin/maintenance">View details</Link></section>
        <AdminPanel title="Quick Actions" className="admin-quick-panel"><div className="admin-quick-actions"><Link to="/admin/venues?create=1"><span><Building2 size={16} /></span>Add Venue</Link><Link to="/admin/events?create=1"><span><CalendarDays size={16} /></span>Add Event</Link><Link to="/admin/users?create=1"><span><Users size={16} /></span>Add User</Link><Link to="/admin/analytics-reports"><span><ChartNoAxesColumn size={16} /></span>View Reports</Link></div></AdminPanel>
      </div>
      <p className="admin-sample-note">User/event totals remain illustrative until their backend contracts are added. Booking totals and venue usage use the Admin API when available.</p>
    </section>
  );
}
