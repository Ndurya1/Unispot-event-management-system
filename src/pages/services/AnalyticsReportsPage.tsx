import { useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, BarChart3, CalendarDays, Download, FileText, TicketCheck, UsersRound } from 'lucide-react';
import { DemoMessage, ServicePageHeading, WorkspacePanel } from './shared';

const metrics = [
  { label: 'Total Events', value: '12', trend: '+2 this month', icon: CalendarDays, tone: 'blue' },
  { label: 'Registrations', value: '684', trend: '+18% this month', icon: TicketCheck, tone: 'violet' },
  { label: 'Attendance', value: '512', trend: '+12% this month', icon: UsersRound, tone: 'mint' },
  { label: 'Venue Bookings', value: '8', trend: '+2 this month', icon: BarChart3, tone: 'amber' },
];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
const activity = [
  { title: 'New event registered', detail: '2 hours ago', icon: TicketCheck },
  { title: 'Venue booking approved', detail: '5 hours ago · Great Hall', icon: CalendarDays },
  { title: 'Attendance report generated', detail: 'Yesterday', icon: FileText },
  { title: 'New registration · Innovation & Tech Day', detail: 'Yesterday', icon: UsersRound },
];
const venues = [
  { name: 'Great Hall', value: 42 },
  { name: 'Seminar Room B', value: 28 },
  { name: 'Auditorium', value: 20 },
  { name: 'Conference Room', value: 10 },
];

export function AnalyticsReportsPage() {
  const [notice, setNotice] = useState('');
  const exportDemo = (format: string) => setNotice(`${format} export is a demo action. These sample metrics are not connected to live records, and no report file was created.`);

  return (
    <section className="sd-page sd-analytics-page">
      <ServicePageHeading
        title="Analytics & Reports"
        description="Track event performance, registrations, attendance, and campus activity at a glance."
        actions={<div className="sd-report-actions"><button className="button button--primary button--small" type="button" onClick={() => exportDemo('Report')}><ArrowDownToLine size={14} />Export Report</button><button className="button button--outline button--small" type="button" onClick={() => exportDemo('PDF')}><Download size={14} />Download PDF</button></div>}
      />
      <p className="sd-data-note"><span /> SAMPLE ANALYTICS · DATA SHOWN FOR DESIGN PREVIEW</p>
      <div className="sd-metric-grid">
        {metrics.map(({ label, value, trend, icon: Icon, tone }) => <article className={`sd-metric-card sd-metric-card--${tone}`} key={label}><span className="sd-metric-icon"><Icon size={18} aria-hidden="true" /></span><span className="sd-metric-label">{label}</span><strong>{value}</strong><small><ArrowUpRight size={12} aria-hidden="true" />{trend}</small></article>)}
      </div>
      <div className="sd-analytics-main-grid">
        <WorkspacePanel title="Event Registrations" action={<select className="sd-period-select" aria-label="Chart period" defaultValue="Last 7 months"><option>Last 7 months</option><option>This semester</option></select>} titleId="analytics-registrations-title">
          <figure className="sd-line-chart"><svg viewBox="0 0 560 205" role="img" aria-labelledby="registrations-chart-title registrations-chart-desc" preserveAspectRatio="none"><title id="registrations-chart-title">Event registrations over seven months</title><desc id="registrations-chart-desc">Sample registrations rise overall from January through July, with a small dip in April.</desc><g className="sd-chart-grid-lines"><line x1="40" y1="25" x2="550" y2="25" /><line x1="40" y1="65" x2="550" y2="65" /><line x1="40" y1="105" x2="550" y2="105" /><line x1="40" y1="145" x2="550" y2="145" /></g><polyline className="sd-chart-line" points="40,142 125,121 210,127 295,91 380,97 465,56 550,30" /><g className="sd-chart-points"><circle cx="40" cy="142" r="4" /><circle cx="125" cy="121" r="4" /><circle cx="210" cy="127" r="4" /><circle cx="295" cy="91" r="4" /><circle cx="380" cy="97" r="4" /><circle cx="465" cy="56" r="4" /><circle cx="550" cy="30" r="4" /></g></svg><figcaption>{months.map((month) => <span key={month}>{month}</span>)}</figcaption></figure>
        </WorkspacePanel>
        <WorkspacePanel title="Event Categories" titleId="analytics-categories-title">
          <div className="sd-category-chart-row"><div className="sd-donut-chart" role="img" aria-label="Event categories: Tech and Innovation 30 percent, Culture and Arts 25 percent, Sports 20 percent, Workshops 15 percent, Other 10 percent"><span>12<small>Events</small></span></div><ul className="sd-category-legend"><li><i className="tone-tech" /><span>Tech &amp; Innovation</span><b>30%</b></li><li><i className="tone-culture" /><span>Culture &amp; Arts</span><b>25%</b></li><li><i className="tone-sports" /><span>Sports</span><b>20%</b></li><li><i className="tone-workshop" /><span>Workshops</span><b>15%</b></li><li><i className="tone-other" /><span>Other</span><b>10%</b></li></ul></div>
        </WorkspacePanel>
      </div>
      <div className="sd-analytics-lower-grid">
        <WorkspacePanel title="Top Venues" titleId="analytics-venues-title"><ul className="sd-venue-bars">{venues.map((venue) => <li key={venue.name}><span>{venue.name}</span><div><i style={{ width: `${venue.value}%` }} /></div><b>{venue.value}%</b></li>)}</ul></WorkspacePanel>
        <WorkspacePanel title="Recent Activity" action={<button type="button" className="sd-link-button" onClick={() => setNotice('Recent activity is sample data for this dashboard preview.')}>View all</button>} titleId="analytics-activity-title"><ul className="sd-activity-list">{activity.map(({ title, detail, icon: Icon }) => <li key={title}><span><Icon size={15} aria-hidden="true" /></span><div><strong>{title}</strong><small>{detail}</small></div></li>)}</ul></WorkspacePanel>
      </div>
      <DemoMessage>{notice}</DemoMessage>
    </section>
  );
}
