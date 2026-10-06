import { useState } from 'react';
import { ArrowDownToLine, CalendarDays, Check, Clock3, MapPin, QrCode, Share2, UsersRound } from 'lucide-react';
import { events } from '../../data/mock';
import { DemoMessage, ServicePageHeading, ServiceTabs, WorkspacePanel } from './shared';

const ticketTabs = [
  { id: 'tickets', label: 'My Tickets' },
  { id: 'organizer', label: 'Organizer View' },
];

export function QrTicketsAttendancePage() {
  const [activeTab, setActiveTab] = useState('tickets');
  const [selectedEventId, setSelectedEventId] = useState(events[0].id);
  const [message, setMessage] = useState('');
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0];

  return (
    <section className="sd-page sd-qr-page">
      <ServicePageHeading
        title="QR Tickets & Attendance"
        description="Generate digital tickets, scan for check-in, and track attendance in real time."
        actions={<div className="sd-qr-hero-art" aria-hidden="true"><span><QrCode size={62} /></span><span className="sd-qr-phone"><QrCode size={38} /><Check size={19} /></span></div>}
      />
      <ServiceTabs tabs={ticketTabs} active={activeTab} onChange={(tab) => { setActiveTab(tab); setMessage(''); }} idPrefix="qr-view" label="Ticket and attendance views" />
      <section id="qr-view-panel-tickets" role="tabpanel" aria-labelledby="qr-view-tab-tickets" hidden={activeTab !== 'tickets'} tabIndex={0}>
        <div className="sd-qr-layout">
          <WorkspacePanel title="Upcoming Events" action={<span className="sd-subtle-count">{events.length} events</span>} titleId="qr-upcoming-title">
            <div className="sd-upcoming-list">
              {events.map((event) => (
                <article className={`sd-upcoming-event${selectedEvent.id === event.id ? ' sd-upcoming-event--selected' : ''}`} key={event.id}>
                  <img src={event.image} alt="" />
                  <div className="sd-upcoming-event-copy"><h3>{event.title}</h3><span><CalendarDays size={13} aria-hidden="true" />{event.date} · {event.time}</span><span><MapPin size={13} aria-hidden="true" />{event.location} · {event.organizer}</span></div>
                  <button className="button button--primary button--small" type="button" onClick={() => { setSelectedEventId(event.id); setMessage('Demo ticket details updated.'); }}>View Ticket</button>
                </article>
              ))}
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="Your Ticket" titleId="qr-ticket-title" className="sd-ticket-panel">
            <div className="sd-ticket-event"><span className="sd-eyebrow">CAMPUS EVENT</span><h3>{selectedEvent.title}</h3><p><CalendarDays size={14} aria-hidden="true" />{selectedEvent.date} · {selectedEvent.time}</p><p><MapPin size={14} aria-hidden="true" />{selectedEvent.location}</p></div>
            <div className="sd-ticket-code-row"><div className="sd-demo-qr" role="img" aria-label="Illustrative QR code; this demo ticket cannot be used for entry"><QrCode size={104} strokeWidth={1.4} /><span>DEMO</span></div><div className="sd-ticket-person"><span className="service-avatar" aria-hidden="true">MT</span><strong>Moses Thomas</strong><small>Student attendee</small><code>Ticket ID: UNS-26-0412-028</code></div></div>
            <DemoMessage>{message || 'Demo ticket only—this QR illustration is not valid for event entry.'}</DemoMessage>
            <div className="sd-ticket-actions"><button className="button button--primary" type="button" onClick={() => setMessage('Demo only—no real ticket file was issued or downloaded.')}><ArrowDownToLine size={15} aria-hidden="true" />Download Ticket</button><button className="button button--outline" type="button" onClick={() => setMessage('Demo only—ticket sharing is not connected.')}><Share2 size={15} aria-hidden="true" />Share</button></div>
          </WorkspacePanel>
        </div>
      </section>

      <section id="qr-view-panel-organizer" role="tabpanel" aria-labelledby="qr-view-tab-organizer" hidden={activeTab !== 'organizer'} tabIndex={0}>
        <div className="sd-attendance-grid">
          <WorkspacePanel title="Attendance · Innovation & Tech Day" titleId="qr-attendance-title">
            <p className="sd-panel-intro">Track event registration and check-in totals for your campus event.</p>
            <div className="sd-attendance-metrics"><div><UsersRound size={17} /><span>Total Registered</span><strong>200</strong></div><div><Check size={17} /><span>Checked In</span><strong>150</strong></div><div><Clock3 size={17} /><span>Not Checked In</span><strong>50</strong></div></div>
            <button className="button button--primary" type="button" onClick={() => setMessage('Camera check-in is not connected in this frontend demo.')}> <QrCode size={16} aria-hidden="true" />Scan QR Code</button>
            <DemoMessage>{message}</DemoMessage>
          </WorkspacePanel>
          <WorkspacePanel title="Attendance Rate" titleId="qr-rate-title" className="sd-attendance-rate-panel">
            <div className="sd-attendance-ring" role="img" aria-label="75 percent of registered attendees have checked in"><span><strong>75%</strong><small>Attendance Rate</small></span></div>
            <p>150 of 200 registered attendees have checked in.</p>
          </WorkspacePanel>
        </div>
      </section>
    </section>
  );
}
