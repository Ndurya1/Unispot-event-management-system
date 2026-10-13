import { useState, type FormEvent } from 'react';
import { ArrowDownToLine, BarChart3, Bell, CalendarCheck, CalendarDays, Check, Clock3, Download, FileText, ListChecks, ShieldCheck, Users } from 'lucide-react';
import { adminKpis, adminSectionData, type AdminSectionId } from '../../data/adminMock';
import { AdminFeedback, AdminMetric, AdminPageHeader, AdminPanel, AdminStatus } from './shared';

export function AdminSpecialSection({ sectionId }: { sectionId: AdminSectionId }) {
  if (sectionId === 'analytics-reports') return <AnalyticsSection />;
  if (sectionId === 'notifications') return <NotificationsSection />;
  if (sectionId === 'policies-rules') return <PoliciesSection />;
  if (sectionId === 'waitlists') return <WaitlistsSection />;
  return <SystemSettingsSection />;
}

function AnalyticsSection() {
  const [notice, setNotice] = useState('');
  return <section className="admin-page"><AdminPageHeader title="Analytics & Reports" description="Platform-wide activity across users, events, bookings, and attendance." action={<div className="admin-report-buttons"><button className="button button--primary button--small" type="button" onClick={() => setNotice('Report prepared as a preview action only. No file was exported.') }><ArrowDownToLine size={14} />Export Report</button><button className="button button--outline button--small" type="button" onClick={() => setNotice('PDF export is not connected in this frontend prototype.') }><Download size={14} />Download PDF</button></div>} />
    <p className="admin-sample-note">SAMPLE PLATFORM METRICS · NOT CONNECTED TO LIVE RECORDS</p>
    <div className="admin-kpi-grid admin-kpi-grid--compact">{adminKpis.map((metric, index) => { const icons = [Users, CalendarDays, CalendarCheck, BarChart3]; return <AdminMetric key={metric.label} {...metric} icon={icons[index]} />; })}</div>
    <div className="admin-analytics-grid"><AdminPanel title="Event Registrations Trend"><figure className="admin-line-chart"><svg viewBox="0 0 640 220" role="img" aria-label="Illustrative registration trend over the last seven months" preserveAspectRatio="none"><g className="admin-grid-lines"><line x1="42" y1="25" x2="626" y2="25"/><line x1="42" y1="72" x2="626" y2="72"/><line x1="42" y1="119" x2="626" y2="119"/><line x1="42" y1="166" x2="626" y2="166"/></g><path className="admin-chart-area" d="M42 157 L125 140 L208 148 L291 107 L374 121 L457 77 L540 91 L626 31 L626 190 L42 190Z"/><polyline className="admin-chart-line" points="42,157 125,140 208,148 291,107 374,121 457,77 540,91 626,31"/></svg><figcaption><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></figcaption></figure></AdminPanel>
      <AdminPanel title="Top Venues"><ul className="admin-top-venues">{[['Great Hall', '42%'], ['Seminar Room A', '26%'], ['Auditorium', '18%'], ['Conference Room', '14%']].map(([name, value]) => <li key={name}><span>{name}</span><i><b style={{ width: value }} /></i><strong>{value}</strong></li>)}</ul></AdminPanel></div>
    <div className="admin-analytics-foot"><AdminPanel title="Report coverage"><p>Registration trends, popular venues, attendance, event categories, booking outcomes, and provider activity.</p><p className="admin-inline-note"><ShieldCheck size={15} /> Exports will become available after reporting is connected to the Admin API.</p></AdminPanel><AdminPanel title="Recent reporting activity"><ul className="admin-activity-list"><li><span className="admin-activity-icon"><FileText size={14}/></span><span><strong>Attendance summary viewed</strong><small>Today · preview data</small></span></li><li><span className="admin-activity-icon"><BarChart3 size={14}/></span><span><strong>Registration trend refreshed</strong><small>Today · preview data</small></span></li></ul></AdminPanel></div>
    <AdminFeedback>{notice}</AdminFeedback>
  </section>;
}

function PoliciesSection() {
  const [maxHours, setMaxHours] = useState('4');
  const [noticeHours, setNoticeHours] = useState('48');
  const [cancelHours, setCancelHours] = useState('24');
  const [restrictedDays, setRestrictedDays] = useState<string[]>(['Sunday']);
  const [eventTypes, setEventTypes] = useState<string[]>(['Workshop', 'Seminar', 'Cultural', 'Social', 'Sports']);
  const [notice, setNotice] = useState('');
  const toggle = (value: string, source: string[], setter: (items: string[]) => void) => setter(source.includes(value) ? source.filter((item) => item !== value) : [...source, value]);
  const save = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setNotice('Policy settings saved in this page preview only. They are not enforced by a backend.'); };
  return <section className="admin-page"><AdminPageHeader title="Booking Rules & Policies" description="Set transparent campus-wide rules that the future booking service can evaluate automatically." />
    <div className="admin-policy-callout admin-policy-callout--large"><ShieldCheck size={20} /><span><strong>Automatic confirmation — no intermediary approval.</strong> When a request meets these rules and the venue slot is available, the system confirms it automatically. A cancellation returns the slot to availability and the waitlist flow can advance it.</span></div>
    <form className="admin-policy-form" onSubmit={save}>
      <AdminPanel title="Booking limits"><div className="admin-policy-grid"><label className="admin-field"><span>Maximum booking duration (hours)</span><input type="number" min="1" max="24" required value={maxHours} onChange={(event) => setMaxHours(event.target.value)} /></label><label className="admin-field"><span>Minimum advance notice (hours)</span><input type="number" min="0" max="720" required value={noticeHours} onChange={(event) => setNoticeHours(event.target.value)} /></label><label className="admin-field"><span>Cancellation notice window (hours)</span><input type="number" min="0" max="720" required value={cancelHours} onChange={(event) => setCancelHours(event.target.value)} /></label></div></AdminPanel>
      <div className="admin-policy-two-col"><AdminPanel title="Restricted days"><p className="admin-muted-copy">Requests on selected days will not pass the automatic availability rules.</p><div className="admin-choice-list">{['Saturday', 'Sunday', 'Public holidays'].map((day) => <label key={day}><input type="checkbox" checked={restrictedDays.includes(day)} onChange={() => toggle(day, restrictedDays, setRestrictedDays)} />{day}</label>)}</div></AdminPanel><AdminPanel title="Allowed event types"><p className="admin-muted-copy">Select event categories eligible to request a campus venue.</p><div className="admin-choice-list admin-choice-list--grid">{['Workshop', 'Seminar', 'Conference', 'Cultural', 'Social', 'Sports'].map((type) => <label key={type}><input type="checkbox" checked={eventTypes.includes(type)} onChange={() => toggle(type, eventTypes, setEventTypes)} />{type}</label>)}</div></AdminPanel></div>
      <AdminPanel title="Cancellation policy"><label className="admin-field"><span>Policy summary shown to requesters</span><textarea rows={3} defaultValue="Cancel before the configured notice window. When a booking is cancelled, its slot returns to availability and eligible waitlist entries follow the automatic queue rules." /></label><div className="admin-approval-lock"><span><Check size={15} /></span><div><strong>Manual approval step: Off</strong><small>Bookings that meet the rules are confirmed automatically. Admins do not approve or reject individual requests.</small></div></div></AdminPanel>
      <div className="admin-form-actions"><button className="button button--primary" type="submit">Save demo policy</button></div>
    </form><AdminFeedback>{notice}</AdminFeedback>
  </section>;
}

function NotificationsSection() {
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'info' | 'success' | 'warning'>('info');
  const [recipient, setRecipient] = useState('All campus users');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('Send now (demo)');
  const [preview, setPreview] = useState<{ title: string; message: string; recipient: string; deliveryTime: string } | null>(null);
  const clearPreview = () => { setPreview(null); setNotice(''); };
  const preparePreview = () => {
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle || !cleanMessage) {
      setPreview(null);
      setNoticeTone('warning');
      setNotice('Add an announcement title and message before previewing or demo-sending.');
      return false;
    }
    setPreview({ title: cleanTitle, message: cleanMessage, recipient, deliveryTime });
    return true;
  };
  const previewAnnouncement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preparePreview()) {
      setNoticeTone('info');
      setNotice('Message preview updated below. No notification was sent.');
    }
  };
  const sendDemo = () => {
    if (preparePreview()) {
      setNoticeTone('success');
      setNotice(`Demo send prepared for ${recipient}. No email, SMS, or push notification was sent.`);
    }
  };
  return <section className="admin-page"><AdminPageHeader title="Notification Management" description="Compose system notices for selected audiences; review the preview before delivery is connected." />
    <div className="admin-special-two-col"><AdminPanel title="Compose announcement"><form className="admin-notification-form" onSubmit={previewAnnouncement}>
      <label className="admin-field"><span>Announcement title</span><input name="title" required value={title} onChange={(event) => { setTitle(event.target.value); clearPreview(); }} placeholder="e.g. Scheduled platform maintenance" /></label>
      <label className="admin-field"><span>Recipient group</span><select value={recipient} onChange={(event) => { setRecipient(event.target.value); clearPreview(); }}><option>All campus users</option><option>Students</option><option>Organizers</option><option>Service providers</option><option>University staff</option></select></label>
      <label className="admin-field"><span>Message</span><textarea name="message" rows={5} required value={message} onChange={(event) => { setMessage(event.target.value); clearPreview(); }} placeholder="Write a clear update for the selected audience…" /></label>
      <label className="admin-field"><span>Delivery time</span><select value={deliveryTime} onChange={(event) => { setDeliveryTime(event.target.value); clearPreview(); }}><option>Send now (demo)</option><option>Schedule for later (demo)</option></select></label>
      <p className="admin-inline-note"><Bell size={15} aria-hidden="true" /> This preview will not send email, SMS, or push notifications.</p>
      <div className="admin-notification-actions"><button className="button button--outline button--small" type="submit">Preview announcement</button><button className="button button--primary button--small" type="button" onClick={sendDemo}>Send demo</button></div>
    </form>
    {preview && <section className="admin-notification-preview" aria-labelledby="admin-notification-preview-title"><p className="admin-notification-preview-meta"><Bell size={14} aria-hidden="true" /> Announcement preview</p><p className="admin-notification-preview-audience"><strong>Audience:</strong> {preview.recipient} · {preview.deliveryTime}</p><h3 id="admin-notification-preview-title">{preview.title}</h3><p className="admin-notification-preview-copy">{preview.message}</p><p className="admin-inline-note"><ShieldCheck size={15} aria-hidden="true" /> Local preview only. No message was sent.</p></section>}
    </AdminPanel>
      <AdminPanel title="Recent announcements"><ul className="admin-announcement-list"><li><span className="admin-notice-dot admin-notice-dot--violet"/><div><strong>Planned maintenance</strong><small>All campus users · Draft preview</small></div><AdminStatus>Draft</AdminStatus></li><li><span className="admin-notice-dot admin-notice-dot--mint"/><div><strong>Event registration reminder</strong><small>Students · Sample record</small></div><AdminStatus>Sent (sample)</AdminStatus></li><li><span className="admin-notice-dot admin-notice-dot--amber"/><div><strong>Provider directory update</strong><small>Service providers · Sample record</small></div><AdminStatus>Scheduled</AdminStatus></li></ul></AdminPanel></div>
    <AdminFeedback tone={noticeTone}>{notice}</AdminFeedback>
  </section>;
}

function WaitlistsSection() {
  const rows = adminSectionData.waitlists.rows;
  const [notice, setNotice] = useState('');
  const previewNotice = (row: (typeof rows)[number]) => setNotice(`Preview only: the next-in-line update for ${row.venue} is ready. No message was sent and no booking was created.`);
  return <section className="admin-page"><AdminPageHeader title="Waitlist & Recurring Booking Management" description="Monitor queue positions and recurring requests across campus; student memberships remain on the user site." />
    <div className="admin-policy-callout"><ListChecks size={18} /><span><strong>Queue changes follow availability rules.</strong> A cancelled venue slot is released automatically; eligible waitlist entries may advance without a manual booking-approval step.</span></div>
    <AdminPanel title="Campus waitlists" action={<span className="admin-preview-tag">Sample queue</span>}><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Venue</th><th>Event</th><th>Requested date</th><th>Queue position</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.filter((row) => row.status !== 'Recurring request').map((row) => <tr key={row.id}><td>{row.venue}</td><td>{row.event}</td><td>{row.date}</td><td>{row.position}</td><td><AdminStatus>{row.status}</AdminStatus></td><td><button className="admin-row-action" type="button" onClick={() => previewNotice(row)}>Preview update</button></td></tr>)}</tbody></table></div></AdminPanel>
    <AdminPanel title="Recurring booking requests"><div className="admin-recurring-admin-list"><article><span><CalendarDays size={17} /></span><div><strong>Tech Club Weekly Meeting</strong><small>Great Hall · Every Wednesday · 2:00–4:00 PM</small></div><AdminStatus>Active (sample)</AdminStatus></article><article><span><CalendarDays size={17} /></span><div><strong>Honors Society Meeting</strong><small>Seminar Room A · Every Friday · 5:00–8:00 PM</small></div><AdminStatus>Active (sample)</AdminStatus></article></div></AdminPanel>
    <AdminFeedback>{notice}</AdminFeedback><p className="admin-inline-note"><Clock3 size={14} /> User join/leave actions remain available at My Waitlists; real queue updates and notifications require the backend.</p>
  </section>;
}

function SystemSettingsSection() {
  const [settings, setSettings] = useState({ eventRegistration: true, qrCheckIn: true, campusAssistant: true, maintenanceMode: false });
  const [notice, setNotice] = useState('');
  const change = (key: keyof typeof settings) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const save = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setNotice('System preferences saved in the current preview only.'); };
  const items: { key: keyof typeof settings; title: string; description: string }[] = [
    { key: 'eventRegistration', title: 'Event registration', description: 'Allow students to register for listed campus events.' },
    { key: 'qrCheckIn', title: 'QR attendance', description: 'Show QR check-in features on event ticket previews.' },
    { key: 'campusAssistant', title: 'UniSpot Assistant', description: 'Show the student-facing help widget.' },
    { key: 'maintenanceMode', title: 'Maintenance mode', description: 'Display a temporary maintenance notice in the demo UI.' },
  ];
  return <section className="admin-page"><AdminPageHeader title="System Settings" description="Configure platform-wide feature preferences and maintenance notices." />
    <form className="admin-settings-form" onSubmit={save}><AdminPanel title="Platform features"><div className="admin-setting-list">{items.map((item) => <label className="admin-setting-row" key={item.key}><span><strong>{item.title}</strong><small>{item.description}</small></span><input type="checkbox" checked={settings[item.key]} onChange={() => change(item.key)} /><i aria-hidden="true" /></label>)}</div></AdminPanel>
      <div className="admin-special-two-col"><AdminPanel title="Regional defaults"><label className="admin-field"><span>Time zone</span><select defaultValue="Africa/Nairobi"><option>Africa/Nairobi</option><option>UTC</option></select></label><label className="admin-field"><span>Default campus</span><input defaultValue="Main Campus" /></label></AdminPanel><AdminPanel title="Preview boundary"><p className="admin-muted-copy">These switches demonstrate the settings screen only. They do not enable server features, protect routes, or change public-site behavior.</p><div className="admin-inline-note"><ShieldCheck size={15} /> Role enforcement and durable configuration must be implemented on the backend.</div></AdminPanel></div>
      <div className="admin-form-actions"><button className="button button--primary" type="submit">Save demo settings</button></div>
    </form><AdminFeedback>{notice}</AdminFeedback>
  </section>;
}
