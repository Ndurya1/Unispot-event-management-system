import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownToLine, Bell, CalendarCheck, CalendarDays, Check, Clock3, Download, ListChecks, ShieldCheck, Users } from 'lucide-react';
import { adminSectionData, type AdminSectionId } from '../../data/adminMock';
import { adminRecipientGroups, getBookingAnalytics, sendAdminAnnouncement, listAdminUsers, updateAdminUserStatus, assignAdminUserRole, removeAdminUserRole } from '../../api/admin';
import type { AdminUserStatus, ApiAdminUser, ApiBookingAnalytics } from '../../api/types';
import { AdminFeedback, AdminMetric, AdminPageHeader, AdminPanel, AdminStatus } from './shared';

const adminRoles = ['ORGANIZER', 'VENUE_ADMIN', 'SYSTEM_ADMIN'];

export function AdminUsersSection() {
  const [users, setUsers] = useState<ApiAdminUser[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminUserStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await listAdminUsers({ search: filter || undefined, status: statusFilter || undefined }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Users could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, [filter, statusFilter]);

  const changeStatus = async (user: ApiAdminUser, status: AdminUserStatus) => {
    setBusyId(user.id);
    setNotice('');
    try {
      await updateAdminUserStatus(user.id, status);
      setNotice(`${user.full_name}'s account status was updated.`);
      await loadUsers();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'The account status could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const changeRole = async (user: ApiAdminUser, roleName: string) => {
    if (!roleName) return;
    setBusyId(user.id);
    setNotice('');
    try {
      if (user.roles.includes(roleName)) await removeAdminUserRole(user.id, roleName);
      else await assignAdminUserRole(user.id, roleName);
      setNotice(`${roleName} was ${user.roles.includes(roleName) ? 'removed from' : 'assigned to'} ${user.full_name}.`);
      await loadUsers();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'The role could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  return <section className="admin-page">
    <AdminPageHeader title="User Management" description="Search campus accounts and manage status and administrator-controlled roles." action={<span className="admin-preview-tag">Live admin data</span>} />
    <div className="admin-policy-callout"><ShieldCheck size={18} aria-hidden="true" /><span><strong>User creation remains unavailable.</strong> Registration is handled through the public authentication flow; this screen manages existing accounts only.</span></div>
    <AdminPanel title="Campus users" action={<div className="admin-table-search"><SearchIcon /><label className="sr-only" htmlFor="admin-user-search">Search users</label><input id="admin-user-search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search name or email" /></div>}>
      <div className="admin-user-filters"><label className="admin-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdminUserStatus | '')}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option></select></label></div>
      {error && <AdminFeedback tone="warning">{error}</AdminFeedback>}
      {notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}
      {loading ? <p className="admin-empty-state">Loading users…</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">User</th><th scope="col">Email</th><th scope="col">Roles</th><th scope="col">Joined</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.full_name}</td><td>{user.email}</td><td><div className="admin-role-list">{user.roles.length ? user.roles.map((role) => <span key={role}>{role}</span>) : <span>—</span>}<select aria-label={`Change role for ${user.full_name}`} value="" disabled={busyId === user.id} onChange={(event) => { void changeRole(user, event.target.value); }}><option value="">Manage role…</option>{adminRoles.map((role) => <option key={role} value={role}>{user.roles.includes(role) ? `Remove ${role}` : `Assign ${role}`}</option>)}</select></div></td><td>{new Date(user.created_at).toLocaleDateString('en-KE')}</td><td><select aria-label={`Change status for ${user.full_name}`} value={user.status} disabled={busyId === user.id} onChange={(event) => { void changeStatus(user, event.target.value as AdminUserStatus); }}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option></select></td><td><span className="admin-mono">{user.id.slice(0, 8)}</span></td></tr>)}{users.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No users match the current filters.</td></tr>}</tbody></table></div>}
      <div className="admin-table-footer"><span>{users.length} live records shown</span><span className="admin-preview-tag">Server-enforced</span></div>
    </AdminPanel>
  </section>;
}

function SearchIcon() {
  return <span aria-hidden="true">⌕</span>;
}

export function AdminSpecialSection({ sectionId }: { sectionId: AdminSectionId }) {
  if (sectionId === 'analytics-reports') return <AnalyticsSection />;
  if (sectionId === 'notifications') return <NotificationsSection />;
  if (sectionId === 'policies-rules') return <PoliciesSection />;
  if (sectionId === 'waitlists') return <WaitlistsSection />;
  return <SystemSettingsSection />;
}

function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<ApiBookingAnalytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void getBookingAnalytics().then(setAnalytics).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Analytics could not be loaded.')); }, []);
  return <section className="admin-page"><AdminPageHeader title="Analytics & Reports" description="Live booking aggregates from the Admin API; event, attendance, provider, and export reporting remain unavailable." action={<div className="admin-report-buttons"><button className="button button--primary button--small" type="button" onClick={() => setError('Report export is not available in the current API.')}><ArrowDownToLine size={14} />Export unavailable</button><button className="button button--outline button--small" type="button" onClick={() => setError('PDF export is not available in the current API.')}><Download size={14} />PDF unavailable</button></div>} />
    {error && <AdminFeedback tone="warning">{error}</AdminFeedback>}
    {!analytics ? <p className="admin-empty-state">Loading booking analytics…</p> : <><div className="admin-kpi-grid admin-kpi-grid--compact"><AdminMetric label="Total Bookings" value={String(analytics.total_bookings)} trend="Live" icon={CalendarCheck} tone="mint" /><AdminMetric label="Confirmed" value={String(analytics.confirmed_bookings)} trend="Live" icon={Check} tone="violet" /><AdminMetric label="Cancelled" value={String(analytics.cancelled_bookings)} trend="Live" icon={CalendarDays} tone="amber" /><AdminMetric label="Expected Attendance" value={String(analytics.total_expected_attendance)} trend="Live" icon={Users} tone="blue" /></div><AdminPanel title="Booking usage by venue"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Venue</th><th scope="col">Bookings</th><th scope="col">Expected attendance</th></tr></thead><tbody>{analytics.venue_usage.map((venue) => <tr key={venue.venue_id}><td>{venue.venue_name}</td><td>{venue.booking_count}</td><td>{venue.expected_attendance}</td></tr>)}{analytics.venue_usage.length === 0 && <tr><td className="admin-empty-cell" colSpan={3}>No booking records match the current dataset.</td></tr>}</tbody></table></div></AdminPanel></>}
    <p className="admin-sample-note">Live booking aggregates only. No report file or cross-domain analytics export is connected.</p>
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
  const [recipient, setRecipient] = useState(adminRecipientGroups[0].value);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ title: string; message: string; recipient: string; deliveryTime: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
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
    setPreview({ title: cleanTitle, message: cleanMessage, recipient, deliveryTime: 'In-app queue' });
    return true;
  };
  const previewAnnouncement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preparePreview()) {
      setNoticeTone('info');
      setNotice('Message preview updated below. No notification was sent.');
    }
  };
  const sendAnnouncement = async () => {
    if (!preparePreview()) return;
    setIsSending(true);
    setNotice('');
    try {
      const result = await sendAdminAnnouncement({ recipient_group: recipient, title: title.trim(), body: message.trim() });
      setNoticeTone('success');
      setNotice(`Announcement queued for ${result.recipient_count} active recipient${result.recipient_count === 1 ? '' : 's'}. It will appear as an in-app notification.`);
      setTitle('');
      setMessage('');
    } catch (sendError) {
      setNoticeTone('warning');
      setNotice(sendError instanceof Error ? sendError.message : 'The announcement could not be sent.');
    } finally {
      setIsSending(false);
    }
  };
  return <section className="admin-page"><AdminPageHeader title="Notification Management" description="Send one-time in-app announcements to active role groups. Email, SMS, push, and scheduling are not connected." />
    <div className="admin-special-two-col"><AdminPanel title="Compose announcement"><form className="admin-notification-form" onSubmit={previewAnnouncement}>
      <label className="admin-field"><span>Announcement title</span><input name="title" required value={title} onChange={(event) => { setTitle(event.target.value); clearPreview(); }} placeholder="e.g. Scheduled platform maintenance" /></label>
      <label className="admin-field"><span>Recipient group</span><select value={recipient} onChange={(event) => { setRecipient(event.target.value as typeof recipient); clearPreview(); }}>{adminRecipientGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}</select></label>
      <label className="admin-field"><span>Message</span><textarea name="message" rows={5} required value={message} onChange={(event) => { setMessage(event.target.value); clearPreview(); }} placeholder="Write a clear update for the selected audience…" /></label>
      <p className="admin-inline-note"><Bell size={15} aria-hidden="true" /> Only in-app delivery is connected. The announcement is queued for the selected active users.</p>
      <div className="admin-notification-actions"><button className="button button--outline button--small" type="submit">Preview announcement</button><button className="button button--primary button--small" type="button" onClick={() => { void sendAnnouncement(); }} disabled={isSending}>{isSending ? 'Sending…' : 'Send announcement'}</button></div>
    </form>
    {preview && <section className="admin-notification-preview" aria-labelledby="admin-notification-preview-title"><p className="admin-notification-preview-meta"><Bell size={14} aria-hidden="true" /> Announcement preview</p><p className="admin-notification-preview-audience"><strong>Audience:</strong> {adminRecipientGroups.find((group) => group.value === preview.recipient)?.label} · {preview.deliveryTime}</p><h3 id="admin-notification-preview-title">{preview.title}</h3><p className="admin-notification-preview-copy">{preview.message}</p><p className="admin-inline-note"><ShieldCheck size={15} aria-hidden="true" /> Review before sending. The server will target active users in this group.</p></section>}
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
