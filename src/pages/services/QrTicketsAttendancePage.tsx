import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, MapPin, QrCode, Share2, UsersRound } from 'lucide-react';
import { checkInEventRegistration, getEventAttendance, listCampusEvents, listMyEventRegistrations } from '../../api/events';
import { ApiError } from '../../api/client';
import type { ApiCampusEvent, ApiEventAttendance, ApiEventRegistration } from '../../api/types';
import { StatusMessage, ServicePageHeading, ServiceTabs, WorkspacePanel } from './shared';

const ticketTabs = [
  { id: 'tickets', label: 'My Tickets' },
  { id: 'organizer', label: 'Attendance' },
];
function apiMessage(error: unknown) { return error instanceof ApiError ? error.message : 'The request could not be completed. Please try again.'; }
function fmt(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

export function QrTicketsAttendancePage() {
  const [activeTab, setActiveTab] = useState('tickets');
  const [events, setEvents] = useState<ApiCampusEvent[]>([]);
  const [registrations, setRegistrations] = useState<ApiEventRegistration[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [attendance, setAttendance] = useState<ApiEventAttendance | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedRegistration = useMemo(() => registrations.find((item) => item.id === selectedId) ?? registrations[0] ?? null, [registrations, selectedId]);
  const selectedEvent = useMemo(() => events.find((item) => item.id === selectedRegistration?.event_id) ?? null, [events, selectedRegistration]);

  async function load() {
    setLoading(true);
    try {
      const [eventList, mine] = await Promise.all([listCampusEvents(), listMyEventRegistrations()]);
      setEvents(eventList);
      setRegistrations(mine);
      if (!selectedId && mine[0]) setSelectedId(mine[0].id);
      const target = mine.find((item: any) => item.id === selectedId) ?? mine[0];
      if (target) setAttendance(await getEventAttendance(target.event_id));
      else setAttendance(null);
    } catch (error) {
      setMessage({ tone: 'warning', text: apiMessage(error) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selectedRegistration) void getEventAttendance(selectedRegistration.event_id).then(setAttendance).catch((error) => setMessage({ tone: 'warning', text: apiMessage(error) })); }, [selectedRegistration?.event_id]);

  async function checkIn() {
    if (!selectedRegistration) return;
    try {
      const updated = await checkInEventRegistration(selectedRegistration.id);
      setMessage({ tone: 'success', text: updated.checked_in_at ? `Checked in at ${fmt(updated.checked_in_at)}.` : 'Checked in.' });
      await load();
    } catch (error) {
      setMessage({ tone: 'warning', text: apiMessage(error) });
    }
  }

  return (
    <section className="sd-page sd-qr-page">
      <ServicePageHeading title="QR Tickets & Attendance" description="View your event tickets, check in, and track attendance." actions={<div className="sd-qr-hero-art" aria-hidden="true"><span><QrCode size={62} /></span><span className="sd-qr-phone"><QrCode size={38} /><Check size={19} /></span></div>} />
      <ServiceTabs tabs={ticketTabs} active={activeTab} onChange={(tab) => { setActiveTab(tab); setMessage(null); }} idPrefix="qr-view" label="Ticket and attendance views" />
      <StatusMessage tone={message?.tone ?? 'info'}>{message?.text}</StatusMessage>
      <section id="qr-view-panel-tickets" role="tabpanel" aria-labelledby="qr-view-tab-tickets" hidden={activeTab !== 'tickets'} tabIndex={0}>
        <div className="sd-qr-layout">
          <WorkspacePanel title="My Tickets" action={<span className="sd-subtle-count">{registrations.length} tickets</span>} titleId="qr-upcoming-title">
            <div className="sd-upcoming-list">
              {registrations.map((reg) => (
                <article className={`sd-upcoming-event${selectedRegistration?.id === reg.id ? ' sd-upcoming-event--selected' : ''}`} key={reg.id}>
                  <div className="sd-upcoming-event-copy"><h3>{reg.event_title}</h3><span><CalendarDays size={13} aria-hidden="true" />Confirmation {reg.confirmation_code}</span><span>{reg.checked_in_at ? `Checked in ${fmt(reg.checked_in_at)}` : 'Not checked in'}</span></div>
                  <button className="button button--primary button--small" type="button" onClick={() => setSelectedId(reg.id)}>View Ticket</button>
                </article>
              ))}
              {!loading && registrations.length === 0 && <p>No tickets yet. Register for an event first.</p>}
            </div>
          </WorkspacePanel>

          {selectedRegistration && <WorkspacePanel title="Your Ticket" titleId="qr-ticket-title" className="sd-ticket-panel">
            <div className="sd-ticket-event"><span className="sd-eyebrow">CAMPUS EVENT</span><h3>{selectedRegistration.event_title}</h3>{selectedEvent && <><p><CalendarDays size={14} aria-hidden="true" />{fmt(selectedEvent.starts_at)} – {fmt(selectedEvent.ends_at)}</p><p><MapPin size={14} aria-hidden="true" />{selectedEvent.location}</p></>}</div>
            <div className="sd-ticket-code-row"><div className="sd-demo-qr" role="img" aria-label="Ticket code"><QrCode size={104} strokeWidth={1.4} /><span>{selectedRegistration.checked_in_at ? 'CHECKED IN' : 'VALID'}</span></div><div className="sd-ticket-person"><strong>{selectedRegistration.full_name}</strong><small>{selectedRegistration.email}</small><code>Ticket ID: {selectedRegistration.confirmation_code}</code></div></div>
            <div className="sd-ticket-actions">
              <button className="button button--primary" type="button" onClick={checkIn} disabled={Boolean(selectedRegistration.checked_in_at)}><Check size={15} aria-hidden="true" />{selectedRegistration.checked_in_at ? 'Checked In' : 'Check In'}</button>
              <button className="button button--outline" type="button" onClick={() => setMessage({ tone: 'info', text: `Ticket ${selectedRegistration.confirmation_code} is ready to present at entry.` })}><Share2 size={15} aria-hidden="true" />Show Ticket</button>
            </div>
          </WorkspacePanel>}
        </div>
      </section>

      <section id="qr-view-panel-organizer" role="tabpanel" aria-labelledby="qr-view-tab-organizer" hidden={activeTab !== 'organizer'} tabIndex={0}>
        <div className="sd-attendance-grid">
          <WorkspacePanel title={attendance ? `Attendance · ${attendance.event_title}` : 'Attendance'} titleId="qr-attendance-title">
            <p className="sd-panel-intro">Track registration and check-in totals for the selected ticket’s event.</p>
            <div className="sd-attendance-metrics"><div><UsersRound size={17} /><span>Total Registered</span><strong>{attendance?.confirmed_registrations ?? 0}</strong></div><div><Check size={17} /><span>Checked In</span><strong>{attendance?.checked_in_registrations ?? 0}</strong></div><div><Clock3 size={17} /><span>Not Checked In</span><strong>{Math.max((attendance?.confirmed_registrations ?? 0) - (attendance?.checked_in_registrations ?? 0), 0)}</strong></div></div>
          </WorkspacePanel>
          <WorkspacePanel title="Attendance Rate" titleId="qr-rate-title" className="sd-attendance-rate-panel">
            <div className="sd-attendance-ring" role="img" aria-label={`${(attendance && attendance.confirmed_registrations ? Math.round((attendance.checked_in_registrations / attendance.confirmed_registrations) * 100) : 0)} percent attendance`}><span><strong>{(attendance && attendance.confirmed_registrations ? Math.round((attendance.checked_in_registrations / attendance.confirmed_registrations) * 100) : 0)}%</strong><small>Attendance Rate</small></span></div>
            <p>{attendance ? `${attendance.checked_in_registrations} of ${attendance.confirmed_registrations} registered attendees have checked in.` : 'Select a ticket to view attendance.'}</p>
          </WorkspacePanel>
        </div>
      </section>
    </section>
  );
}
