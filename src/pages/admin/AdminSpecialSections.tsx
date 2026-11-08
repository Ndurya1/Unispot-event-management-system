import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownToLine, CalendarCheck, CalendarDays, Check, Download, Search, Trash2, Users } from 'lucide-react';
import { adminRecipientGroups, assignAdminUserRole, getBookingAnalytics, listAdminUsers, removeAdminUserRole, sendAdminAnnouncement } from '../../api/admin';
import { listOrganizations } from '../../api/organizations';
import { ApiError } from '../../api/client';
import { createMaintenance, createPolicy, deletePolicy, listMaintenance, listPolicies, listSystemSettings, updateMaintenance, updatePolicy, upsertSystemSetting } from '../../api/operations';
import type { AdminSectionId } from '../../data/adminMock';
import { AdminFeedback, AdminMetric, AdminPageHeader, AdminPanel, AdminStatus } from './shared';
import type { ApiAdminUser, ApiBookingAnalytics, ApiMaintenanceRecord, ApiPolicyRule, ApiSystemSetting, ApiServiceProvider } from '../../api/types';

const adminRoles = ['ORGANIZER', 'VENUE_ADMIN', 'SYSTEM_ADMIN', 'SERVICE_PROVIDER', 'UNIVERSITY_STAFF'];

export function AdminUsersSection() {
  const [rows, setRows] = useState<ApiAdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED'>('ALL');
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'info' | 'success' | 'warning'>('info');
  const [busyKey, setBusyKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const loadUsers = async (nextSearch = search, nextStatus = statusFilter) => { setIsLoading(true); try { const users = await listAdminUsers({ search: nextSearch || undefined, status: nextStatus === 'ALL' ? undefined : nextStatus, limit: 100 }); setRows(users); setNotice(''); setNoticeTone('info'); } catch (error) { setNoticeTone('warning'); setNotice(error instanceof ApiError ? error.message : 'Admin users could not be loaded.'); } finally { setIsLoading(false); } };
  useEffect(() => { void loadUsers(); }, []);
  const visibleRows = useMemo(() => rows, [rows]);
  const statusBadge = (status: ApiAdminUser['status']) => status === 'ACTIVE' ? 'Active' : status === 'SUSPENDED' ? 'Suspended' : 'Disabled';
  const run = async (key: string, action: () => Promise<void>, message: string) => { setBusyKey(key); setNotice(''); try { await action(); setNoticeTone('success'); setNotice(message); await loadUsers(); } catch (error) { setNoticeTone('warning'); setNotice(error instanceof ApiError ? error.message : 'Action failed.'); } finally { setBusyKey(''); } };
  return <section className="admin-page"><AdminPageHeader title="Users" description="Manage account status and roles. Changes affect access control." action={<button className="button button--outline button--small" type="button" onClick={() => { void loadUsers(); }} disabled={isLoading}>{isLoading ? 'Refreshing…' : 'Refresh'}</button>} /><AdminPanel title="User directory" action={<div className="admin-inline-actions"><label className="admin-table-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search users</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" /></label><select className="admin-inline-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option></select><button className="button button--outline button--small" type="button" onClick={() => { void loadUsers(); }}>Apply</button></div>}><AdminFeedback tone={noticeTone}>{notice}</AdminFeedback>{isLoading ? <p className="admin-empty-state">Loading users…</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td><strong>{row.full_name}</strong></td><td><span className="admin-mono">{row.email}</span></td><td><div className="admin-role-list">{row.roles.length ? row.roles.map((role) => <span className="admin-role-chip" key={`${row.id}-${role}`}>{role}<button type="button" aria-label={`Remove ${role} from ${row.full_name}`} disabled={busyKey === `${row.id}-remove-${role}`} onClick={() => { void run(`${row.id}-remove-${role}`, () => removeAdminUserRole(row.id, role), `Removed ${role} from ${row.full_name}.`); }}>×</button></span>) : <span className="admin-muted">No roles</span>}</div></td><td><AdminStatus>{statusBadge(row.status)}</AdminStatus></td><td><div className="admin-action-stack"><select className="admin-inline-select" defaultValue="" disabled={busyKey.startsWith(row.id)} onChange={(e) => { const role = e.target.value; if (!role) return; void run(`${row.id}-add-${role}`, () => assignAdminUserRole(row.id, role), `Assigned ${role} to ${row.full_name}.`); e.target.value = ''; }} aria-label={`Assign role to ${row.full_name}`}><option value="">Assign role…</option>{adminRoles.filter((r) => !row.roles.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}</select></div></td></tr>)}{visibleRows.length === 0 && <tr><td className="admin-empty-cell" colSpan={5}>No users matched.</td></tr>}</tbody></table></div>}</AdminPanel></section>;
}

export function AdminOrganizationsSection() { const [rows, setRows] = useState<Awaited<ReturnType<typeof listOrganizations>>>([]); const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(true); const load = async () => { setIsLoading(true); try { setRows(await listOrganizations()); setError(''); } catch (e) { setError(e instanceof ApiError ? e.message : 'Organizations could not be loaded.'); } finally { setIsLoading(false); } }; useEffect(() => { void load(); }, []); return <section className="admin-page"><AdminPageHeader title="Organizations" description="Live organization records." action={<button className="button button--outline button--small" type="button" onClick={() => { void load(); }} disabled={isLoading}>{isLoading ? 'Refreshing…' : 'Refresh'}</button>} /><AdminPanel title="Organization records" action={<span className="admin-preview-tag">Live data</span>}>{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}{isLoading ? <p className="admin-empty-state">Loading organizations…</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Slug</th><th>Type</th><th>Status</th><th>ID</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.slug}</td><td>{row.organization_type}</td><td><AdminStatus>{row.status}</AdminStatus></td><td><span className="admin-mono" title={row.id}>{row.id.slice(0, 8)}</span></td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={5}>No organizations.</td></tr>}</tbody></table></div>}</AdminPanel></section>; }
export function AdminServiceProvidersSection() {
  const [rows, setRows] = useState<ApiServiceProvider[]>([]);
  const [requests, setRequests] = useState<import('../../api/types').ApiServiceRequest[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [adminUsers, setAdminUsers] = useState<import('../../api/types').ApiAdminUser[]>([]);
  const [form, setForm] = useState({ name: '', category: '', description: '', location: 'Main Campus', price_from_kes: '0', availability: 'week', contact_email: '', contact_phone: '', owner_user_id: '', status: 'PENDING' as ApiServiceProvider['status'] });
  const load = async () => {
    setIsLoading(true);
    try {
      const [{ listServiceProvidersAdmin, listServiceRequestsAdmin }, { listAdminUsers }] = await Promise.all([import('../../api/providers'), import('../../api/admin')]);
      const [p, r, users] = await Promise.all([listServiceProvidersAdmin(), listServiceRequestsAdmin(), listAdminUsers({ limit: 100 }).catch(() => [])]);
      setRows(p); setRequests(r); setAdminUsers(users); setError('');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Service providers could not be loaded.'); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(''); setNotice('');
    try {
      const { createServiceProviderAdmin } = await import('../../api/providers');
      await createServiceProviderAdmin({ ...form, price_from_kes: Number(form.price_from_kes) || 0, contact_email: form.contact_email || undefined, contact_phone: form.contact_phone || undefined, owner_user_id: form.owner_user_id || undefined });
      setNotice('Provider created.'); setForm({ name: '', category: '', description: '', location: 'Main Campus', price_from_kes: '0', availability: 'week', contact_email: '', contact_phone: '', owner_user_id: '', status: 'PENDING' }); await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create provider.'); }
  };
  const setStatus = async (providerId: string, status: ApiServiceProvider['status']) => {
    try { const { updateServiceProviderAdmin } = await import('../../api/providers'); await updateServiceProviderAdmin(providerId, { status }); setNotice(`Provider ${status.toLowerCase()}.`); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update provider.'); }
  };
  return <section className="admin-page"><AdminPageHeader title="Service Providers" description="Approve providers, manage profiles, and review service requests." action={<button className="button button--outline button--small" type="button" onClick={() => { void load(); }} disabled={isLoading}>{isLoading ? 'Refreshingâ€¦' : 'Refresh'}</button>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}{notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}
    <AdminPanel title="Create provider profile"><form className="admin-notification-form" onSubmit={create}><label className="admin-field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label className="admin-field"><span>Category</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></label><label className="admin-field"><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label><label className="admin-field"><span>From price (KES)</span><input type="number" min={0} value={form.price_from_kes} onChange={(e) => setForm({ ...form, price_from_kes: e.target.value })} /></label><label className="admin-field"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ApiServiceProvider['status'] })}><option value="PENDING">PENDING</option><option value="ACTIVE">ACTIVE</option><option value="SUSPENDED">SUSPENDED</option></select></label><label className="admin-field"><span>Contact email</span><input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label><label className="admin-field"><span>Contact phone</span><input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></label><label className="admin-field"><span>Owner account (optional)</span><select value={form.owner_user_id} onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })}><option value="">No owner assigned</option>{adminUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}</select></label><label className="admin-field"><span>Description</span><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><button className="button button--primary button--small" type="submit">Create provider</button></form></AdminPanel>
    <AdminPanel title="Provider records">{isLoading ? <p className="admin-empty-state">Loadingâ€¦</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Provider</th><th>Category</th><th>Location</th><th>Status</th><th>Owner</th><th>Actions</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.category}</td><td>{row.location}</td><td><AdminStatus>{row.status}</AdminStatus></td><td><span className="admin-mono" title={row.owner_user_id || ''}>{row.owner_user_id ? row.owner_user_id.slice(0,8) : 'â€”'}</span></td><td><div className="admin-inline-actions">{row.status !== 'ACTIVE' && <button className="button button--outline button--small" type="button" onClick={() => { void setStatus(row.id, 'ACTIVE'); }}>Approve</button>}{row.status !== 'SUSPENDED' && <button className="button button--outline button--small" type="button" onClick={() => { void setStatus(row.id, 'SUSPENDED'); }}>Suspend</button>}</div></td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No service providers.</td></tr>}</tbody></table></div>}</AdminPanel>
    <AdminPanel title="Service requests"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Provider</th><th>Status</th><th>Requested</th><th>Quote</th><th>Assign</th><th>Admin status</th></tr></thead><tbody>{requests.map((r) => <tr key={r.id}><td><strong>{r.event_name}</strong><div className="admin-muted admin-mono">{r.confirmation_code}</div></td><td>{r.provider_name}</td><td><AdminStatus>{r.status}</AdminStatus></td><td>{new Date(r.requested_date).toLocaleString('en-KE')}</td><td>{r.quote_amount_kes != null ? `KES ${r.quote_amount_kes}` : 'â€”'}</td><td><select className="admin-inline-select" defaultValue={r.assigned_provider_id || ''} onChange={async (e) => { try { const { assignServiceRequestAdmin } = await import('../../api/providers'); await assignServiceRequestAdmin(r.id, e.target.value || null); setNotice('Assignment updated.'); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not assign request.'); } }}><option value="">Unassigned</option>{rows.filter((p)=>p.status==='ACTIVE').map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></td><td><select className="admin-inline-select" defaultValue={r.status} onChange={async (e) => { try { const { updateServiceRequestStatusAdmin } = await import('../../api/providers'); await updateServiceRequestStatusAdmin(r.id, e.target.value as any); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update request.'); } }}>{['PENDING','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED'].map((s)=><option key={s} value={s}>{s}</option>)}</select></td></tr>)}{requests.length === 0 && <tr><td className="admin-empty-cell" colSpan={7}>No service requests.</td></tr>}</tbody></table></div></AdminPanel>
  </section>;
}

export function AdminSpecialSection({ sectionId }: { sectionId: AdminSectionId }) {
  if (sectionId === 'events') return <EventsAdminSection />;
  if (sectionId === 'organizations') return <AdminOrganizationsSection />;
  if (sectionId === 'service-providers') return <AdminServiceProvidersSection />;
  if (sectionId === 'analytics-reports') return <AnalyticsSection />;
  if (sectionId === 'notifications') return <NotificationsSection />;
  if (sectionId === 'audit-logs') return <AuditLogsSection />;
  if (sectionId === 'allocations') return <AllocationsSection />;
  if (sectionId === 'registrations') return <RegistrationsSection />;
  if (sectionId === 'equipment') return <EquipmentAdminSection />;
  if (sectionId === 'bookings') return <BookingsAdminSection />;
  if (sectionId === 'policies-rules') return <PoliciesSection />;
  if (sectionId === 'waitlists') return <WaitlistsSection />;
  if (sectionId === 'maintenance') return <MaintenanceSection />;
  if (sectionId === 'system-settings') return <SystemSettingsSection />;
  if (sectionId === 'certificates') return <CertificatesAdminSection />;
  return <section className="admin-page"><AdminPageHeader title="Admin" description="Section not available." /></section>;
}


function EventsAdminSection() {
  const [rows, setRows] = useState<import('../../api/types').ApiCampusEvent[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState({ id: '', title: '', category: '', organizer: '', location: '', capacity: '100', status: 'PUBLISHED' as 'PUBLISHED' | 'CANCELLED' });
  const load = async () => {
    try { const { listAdminEvents } = await import('../../api/events'); setRows(await listAdminEvents(true)); setError(''); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Events could not be loaded.'); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!form.id) return; setBusyId(form.id); setError(''); setNotice('');
    try {
      const { updateCampusEvent } = await import('../../api/events');
      await updateCampusEvent(form.id, { title: form.title, category: form.category || undefined, organizer: form.organizer || undefined, location: form.location || undefined, capacity: Number(form.capacity) || 1, status: form.status });
      setNotice('Event updated.'); setForm({ id: '', title: '', category: '', organizer: '', location: '', capacity: '100', status: 'PUBLISHED' }); await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update event.'); }
    finally { setBusyId(''); }
  };
  const cancel = async (eventId: string) => {
    setBusyId(eventId); setError(''); setNotice('');
    try { const { cancelCampusEvent } = await import('../../api/events'); await cancelCampusEvent(eventId); setNotice('Event cancelled.'); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not cancel event.'); }
    finally { setBusyId(''); }
  };
  return <section className="admin-page">
    <AdminPageHeader title="Event Management" description="Live admin event actions. Cancelling an event releases its linked venue reservation and notifies registrants. Time/venue edits revalidate conflicts when a venue reservation is linked." action={<span className="admin-preview-tag">Live admin data</span>} />
    {error && <AdminFeedback tone="warning">{error}</AdminFeedback>}
    {notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}
    {form.id && <AdminPanel title="Edit event"><form className="admin-notification-form" onSubmit={save}><label className="admin-field"><span>Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label className="admin-field"><span>Category</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label><label className="admin-field"><span>Organizer</span><input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} /></label><label className="admin-field"><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label><label className="admin-field"><span>Capacity</span><input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required /></label><label className="admin-field"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'PUBLISHED' | 'CANCELLED' })}><option value="PUBLISHED">PUBLISHED</option><option value="CANCELLED">CANCELLED</option></select></label><div className="admin-form-actions"><button className="button button--outline button--small" type="button" onClick={() => setForm({ id: '', title: '', category: '', organizer: '', location: '', capacity: '100', status: 'PUBLISHED' })}>Close</button><button className="button button--primary button--small" type="submit" disabled={busyId === form.id}>{busyId === form.id ? 'Saving…' : 'Save event'}</button></div></form></AdminPanel>}
    <AdminPanel title="Events"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Title</th><th>Venue/Location</th><th>Starts</th><th>Capacity</th><th>Confirmed</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.title}{r.reservation_id ? <div className="admin-muted">Reserved venue</div> : null}</td><td>{r.venue_name || r.location || '—'}</td><td>{new Date(r.starts_at).toLocaleString('en-KE')}</td><td>{r.capacity}</td><td>{r.confirmed_registrations}</td><td><AdminStatus>{r.status}</AdminStatus></td><td className="admin-table-actions"><button type="button" className="admin-row-action" onClick={() => setForm({ id: r.id, title: r.title, category: r.category || '', organizer: r.organizer || '', location: r.location || '', capacity: String(r.capacity), status: r.status })}>Edit</button>{r.status !== 'CANCELLED' && <button type="button" className="admin-row-action" disabled={busyId === r.id} onClick={() => { void cancel(r.id); }}>Cancel</button>}</td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={7}>No events.</td></tr>}</tbody></table></div></AdminPanel>
  </section>;
}

function AuditLogsSection() {
  const [rows, setRows] = useState<import('../../api/types').ApiAuditEvent[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void import('../../api/admin').then(({ listAuditEvents }) => listAuditEvents({ limit: 100 })).then(setRows).catch((e) => setError(e instanceof ApiError ? e.message : 'Audit logs could not be loaded.')); }, []);
  return <section className="admin-page"><AdminPageHeader title="Audit Logs" description="Live audit events from the backend." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}<AdminPanel title="Recent activity"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Actor type</th><th>Outcome</th><th>Request</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString('en-KE')}</td><td>{r.action}</td><td>{r.target_type}{r.target_id ? ` ${String(r.target_id).slice(0, 8)}` : ''}</td><td>{r.actor_type}</td><td><AdminStatus>{r.outcome}</AdminStatus></td><td><span className="admin-mono" title={r.request_id}>{r.request_id.slice(0, 8)}</span></td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No audit events.</td></tr>}</tbody></table></div></AdminPanel></section>;
}

function AllocationsSection() {
  const [rows, setRows] = useState<import('../../api/types').ApiAllocation[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void import('../../api/admin').then(({ listAllocations }) => listAllocations({ limit: 100 })).then(setRows).catch((e) => setError(e instanceof ApiError ? e.message : 'Allocations could not be loaded.')); }, []);
  return <section className="admin-page"><AdminPageHeader title="Resource Allocations" description="Live venue allocations from confirmed/pending bookings." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}<AdminPanel title="Allocations"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Venue</th><th>Starts</th><th>Ends</th><th>Attendance</th><th>Status</th><th>Confirmation</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.venue_name}</td><td>{new Date(r.starts_at).toLocaleString('en-KE')}</td><td>{new Date(r.ends_at).toLocaleString('en-KE')}</td><td>{r.expected_attendance}</td><td><AdminStatus>{r.status}</AdminStatus></td><td><span className="admin-mono">{r.confirmation_code}</span></td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No allocations.</td></tr>}</tbody></table></div></AdminPanel></section>;
}

function RegistrationsSection() {
  const [rows, setRows] = useState<import('../../api/types').ApiEventRegistration[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void import('../../api/events').then(({ listAllEventRegistrations }) => listAllEventRegistrations()).then(setRows).catch((e) => setError(e instanceof ApiError ? e.message : 'Registrations could not be loaded.')); }, []);
  return <section className="admin-page"><AdminPageHeader title="Event Registrations" description="Live event registrations across campus events." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}<AdminPanel title="Registrations"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Registrant</th><th>Email</th><th>Status</th><th>Checked in</th><th>Confirmation</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.event_title}</td><td>{r.full_name}</td><td>{r.email}</td><td><AdminStatus>{r.status}</AdminStatus></td><td>{r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('en-KE') : '—'}</td><td><span className="admin-mono">{r.confirmation_code}</span></td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No registrations.</td></tr>}</tbody></table></div></AdminPanel></section>;
}

function EquipmentAdminSection() {
  const [items, setItems] = useState<import('../../api/equipment').ApiEquipmentItem[]>([]);
  const [reservations, setReservations] = useState<import('../../api/types').ApiEquipmentReservation[]>([]);
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const load = async () => { try { const [{ listEquipmentItems, listAllEquipmentReservations }] = await Promise.all([import('../../api/equipment')]); const [i, r] = await Promise.all([listEquipmentItems(), listAllEquipmentReservations()]); setItems(i); setReservations(r); } catch (e) { setError(e instanceof ApiError ? e.message : 'Equipment data could not be loaded.'); } };
  useEffect(() => { void load(); }, []);
  const create = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setError(''); setNotice(''); const fd = new FormData(e.currentTarget); try { const { createEquipmentItem } = await import('../../api/equipment'); await createEquipmentItem({ slug: String(fd.get('slug')), name: String(fd.get('name')), description: String(fd.get('description') || ''), total_quantity: Number(fd.get('total_quantity') || 0) }); setNotice('Equipment item created.'); e.currentTarget.reset(); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create item.'); } };
  return <section className="admin-page"><AdminPageHeader title="Equipment & Assets" description="Live equipment inventory and reservations." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}{notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}<AdminPanel title="Add equipment item"><form className="admin-notification-form" onSubmit={create}><label className="admin-field"><span>Slug</span><input name="slug" required /></label><label className="admin-field"><span>Name</span><input name="name" required /></label><label className="admin-field"><span>Description</span><input name="description" /></label><label className="admin-field"><span>Total quantity</span><input name="total_quantity" type="number" min={0} required /></label><button className="button button--primary button--small" type="submit">Create item</button></form></AdminPanel><AdminPanel title="Inventory"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Slug</th><th>Total</th><th>Status</th><th>ID</th></tr></thead><tbody>{items.map((i) => <tr key={i.id}><td>{i.name}</td><td>{i.slug}</td><td>{i.total_quantity}</td><td><AdminStatus>{i.status}</AdminStatus></td><td><span className="admin-mono" title={i.id}>{i.id.slice(0, 8)}</span></td></tr>)}{items.length === 0 && <tr><td className="admin-empty-cell" colSpan={5}>No equipment items.</td></tr>}</tbody></table></div></AdminPanel><AdminPanel title="Reservations"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Equipment</th><th>Quantity</th><th>Starts</th><th>Ends</th><th>Status</th><th>Confirmation</th></tr></thead><tbody>{reservations.map((r) => <tr key={r.id}><td>{r.equipment_name}</td><td>{r.quantity}</td><td>{new Date(r.starts_at).toLocaleString('en-KE')}</td><td>{new Date(r.ends_at).toLocaleString('en-KE')}</td><td><AdminStatus>{r.status}</AdminStatus></td><td><span className="admin-mono">{r.confirmation_code}</span></td></tr>)}{reservations.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No reservations.</td></tr>}</tbody></table></div></AdminPanel></section>;
}

function BookingsAdminSection() {
  const [rows, setRows] = useState<import('../../api/types').ApiBooking[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = async () => {
    try {
      const { listAdminBookings } = await import('../../api/bookings');
      setRows(await listAdminBookings({ limit: 150 }));
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Bookings could not be loaded.');
    }
  };
  useEffect(() => { void load(); }, []);
  const cancel = async (bookingId: string) => {
    setBusyId(bookingId); setError(''); setNotice('');
    try {
      const { adminCancelBooking } = await import('../../api/bookings');
      await adminCancelBooking(bookingId, 'Cancelled by admin');
      setNotice('Booking cancelled and slot released (server-enforced).');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel booking.');
    } finally { setBusyId(''); }
  };
  return <section className="admin-page">
    <AdminPageHeader title="Event Bookings" description="Live admin booking management. Cancelling a confirmed booking runs the backend admin cancel flow (releases reservation, notifies requester, audits)." action={<span className="admin-preview-tag">Live admin data</span>} />
    {error && <AdminFeedback tone="warning">{error}</AdminFeedback>}
    {notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}
    <AdminPanel title="Bookings"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Venue</th><th>Starts</th><th>Ends</th><th>Attendance</th><th>Status</th><th>Confirmation</th><th>Action</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.event_name}</td><td>{r.venue_name}</td><td>{new Date(r.starts_at).toLocaleString('en-KE')}</td><td>{new Date(r.ends_at).toLocaleString('en-KE')}</td><td>{r.expected_attendance}</td><td><AdminStatus>{r.status}</AdminStatus></td><td><span className="admin-mono">{r.confirmation_code}</span></td><td>{r.status === 'CONFIRMED' ? <button className="button button--outline button--small" type="button" disabled={busyId === r.id} onClick={() => { void cancel(r.id); }}>{busyId === r.id ? 'Cancelling…' : 'Cancel (admin override)'}</button> : '—'}</td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={8}>No bookings.</td></tr>}</tbody></table></div></AdminPanel>
    <AdminFeedback>Admin cancel bypasses the 24-hour requester notice rule (intentional override), releases the reservation slot, notifies the requester in-app, and records an audit event. Reinstatement/force-confirm is not implemented.</AdminFeedback>
  </section>;
}

function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<ApiBookingAnalytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void getBookingAnalytics().then(setAnalytics).catch((e) => setError(e instanceof ApiError ? e.message : 'Analytics could not be loaded.')); }, []);
  return <section className="admin-page"><AdminPageHeader title="Analytics & Reports" description="Live booking aggregates from the Admin API." action={<div className="admin-report-buttons"><button className="button button--primary button--small" type="button" onClick={() => setError('Report export is not available in the current API.')}><ArrowDownToLine size={14} />Export unavailable</button><button className="button button--outline button--small" type="button" onClick={() => setError('PDF export is not available in the current API.')}><Download size={14} />PDF unavailable</button></div>} />
    {error && <AdminFeedback tone="warning">{error}</AdminFeedback>}
    {!analytics ? <p className="admin-empty-state">Loading booking analytics…</p> : <><div className="admin-kpi-grid admin-kpi-grid--compact"><AdminMetric label="Total Bookings" value={String(analytics.total_bookings)} trend="Live" icon={CalendarCheck} tone="mint" /><AdminMetric label="Confirmed" value={String(analytics.confirmed_bookings)} trend="Live" icon={Check} tone="violet" /><AdminMetric label="Cancelled" value={String(analytics.cancelled_bookings)} trend="Live" icon={CalendarDays} tone="amber" /><AdminMetric label="Expected Attendance" value={String(analytics.total_expected_attendance)} trend="Live" icon={Users} tone="blue" /></div><AdminPanel title="Booking usage by venue"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Venue</th><th>Bookings</th><th>Expected attendance</th></tr></thead><tbody>{analytics.venue_usage.map((v) => <tr key={v.venue_id}><td>{v.venue_name}</td><td>{v.booking_count}</td><td>{v.expected_attendance}</td></tr>)}{analytics.venue_usage.length === 0 && <tr><td className="admin-empty-cell" colSpan={3}>No booking records.</td></tr>}</tbody></table></div></AdminPanel></>}
  </section>;
}

﻿function NotificationsSection() {
  const [notice, setNotice] = useState(''); const [noticeTone, setNoticeTone] = useState<'info' | 'success' | 'warning'>('info');
  const [recipient, setRecipient] = useState(adminRecipientGroups[0].value); const [title, setTitle] = useState(''); const [message, setMessage] = useState(''); const [isSending, setIsSending] = useState(false);
  const sendAnnouncement = async (e: FormEvent) => {
    e.preventDefault(); if (!title.trim() || !message.trim()) { setNoticeTone('warning'); setNotice('Add title and message.'); return; }
    setIsSending(true); setNotice('');
    try { const result = await sendAdminAnnouncement({ recipient_group: recipient, title: title.trim(), body: message.trim() }); setNoticeTone('success'); setNotice(`Queued for ${result.recipient_count} active recipient(s).`); setTitle(''); setMessage(''); }
    catch (err) { setNoticeTone('warning'); setNotice(err instanceof ApiError ? err.message : 'Announcement failed.'); } finally { setIsSending(false); }
  };
  return <section className="admin-page"><AdminPageHeader title="Notifications" description="Send in-app announcements to active role groups." />
    <AdminPanel title="Compose announcement"><form className="admin-notification-form" onSubmit={sendAnnouncement}><label className="admin-field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label className="admin-field"><span>Recipient group</span><select value={recipient} onChange={(e) => setRecipient(e.target.value as typeof recipient)}>{adminRecipientGroups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></label><label className="admin-field"><span>Message</span><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required /></label><button className="button button--primary button--small" type="submit" disabled={isSending}>{isSending ? 'Sending…' : 'Send'}</button></form></AdminPanel>
    <AdminFeedback tone={noticeTone}>{notice}</AdminFeedback>
  </section>;
}

function WaitlistsSection() {
  const [waitlists, setWaitlists] = useState<import('../../api/types').ApiWaitlist[]>([]);
  const [recurring, setRecurring] = useState<import('../../api/types').ApiRecurringSchedule[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    void Promise.all([
      import('../../api/scheduling').then(({ listAllWaitlists }) => listAllWaitlists()).catch(() => []),
      import('../../api/scheduling').then(({ listAllRecurring }) => listAllRecurring()).catch(() => []),
    ]).then(([w, r]) => { setWaitlists(w); setRecurring(r); }).catch((e) => setNotice(e instanceof ApiError ? e.message : 'Scheduling data could not be loaded.'));
  }, []);
  return <section className="admin-page">
    <AdminPageHeader title="Waitlists & Recurring" description="Live admin view of waitlist entries and recurring schedules." action={<span className="admin-preview-tag">Live admin data</span>} />
    {notice && <AdminFeedback tone="warning">{notice}</AdminFeedback>}
    <AdminPanel title="Waitlists"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Venue</th><th>Event</th><th>Requested</th><th>Status</th><th>Confirmation</th></tr></thead><tbody>{waitlists.map((w) => <tr key={w.id}><td>{w.venue_name}</td><td>{w.event_name}</td><td>{new Date(w.requested_date).toLocaleDateString('en-KE')} {w.requested_start}–{w.requested_end}</td><td><AdminStatus>{w.status}</AdminStatus></td><td><span className="admin-mono">{w.confirmation_code}</span></td></tr>)}{waitlists.length === 0 && <tr><td className="admin-empty-cell" colSpan={5}>No waitlist entries.</td></tr>}</tbody></table></div></AdminPanel>
    <AdminPanel title="Recurring schedules"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Venue</th><th>Event</th><th>Day</th><th>Time</th><th>Status</th><th>Confirmation</th></tr></thead><tbody>{recurring.map((r) => <tr key={r.id}><td>{r.venue_name}</td><td>{r.event_name}</td><td>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][r.day_of_week] ?? r.day_of_week}</td><td>{r.start_time}–{r.end_time}</td><td><AdminStatus>{r.status}</AdminStatus></td><td><span className="admin-mono">{r.confirmation_code}</span></td></tr>)}{recurring.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No recurring schedules.</td></tr>}</tbody></table></div></AdminPanel>
  </section>;
}

function CertificatesAdminSection() {
  const [rows, setRows] = useState<import('../../api/types').ApiCertificate[]>([]); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = async () => { try { const { listAdminCertificates } = await import('../../api/certificates'); setRows(await listAdminCertificates()); } catch (e) { setError(e instanceof ApiError ? e.message : 'Certificates could not be loaded.'); } };
  useEffect(() => { void load(); }, []);
  const revoke = async (id: string) => { if (!window.confirm('Revoke this certificate?')) return; try { const { revokeCertificate } = await import('../../api/certificates'); await revokeCertificate(id, 'Revoked by admin'); setNotice('Certificate revoked.'); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not revoke certificate.'); } };
  return <section className="admin-page"><AdminPageHeader title="Certificates" description="Live backend-issued certificates and verification records." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}{notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}<AdminPanel title="Issued certificates"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Recipient</th><th>Event</th><th>Code</th><th>Issued</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.recipient_name}</td><td>{r.event_title}</td><td><span className="admin-mono">{r.verification_code}</span></td><td>{new Date(r.issued_at).toLocaleString('en-KE')}</td><td><AdminStatus>{r.is_valid ? 'Valid' : 'Revoked'}</AdminStatus></td><td>{r.is_valid ? <button className="button button--outline button--small" type="button" onClick={() => { void revoke(r.id); }}>Revoke</button> : '—'}</td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No certificates issued.</td></tr>}</tbody></table></div></AdminPanel></section>;
}


function PoliciesSection() {
  const [rows, setRows] = useState<ApiPolicyRule[]>([]); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = async () => { try { setRows(await listPolicies()); } catch (e) { setError(e instanceof ApiError ? e.message : 'Policies could not be loaded.'); } };
  useEffect(() => { void load(); }, []);
  const create = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setError(''); setNotice(''); const fd = new FormData(e.currentTarget); try { await createPolicy({ name: String(fd.get('name')), scope: String(fd.get('scope') || 'BOOKING'), enabled: true, config_json: {}, description: String(fd.get('description') || '') || undefined }); setNotice('Policy created.'); e.currentTarget.reset(); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create policy.'); } };
  const toggle = async (p: ApiPolicyRule) => { try { await updatePolicy(p.id, { enabled: !p.enabled }); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update policy.'); } };
  const remove = async (id: string) => { if (!window.confirm('Delete this policy rule?')) return; try { await deletePolicy(id); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not delete policy.'); } };
  return <section className="admin-page"><AdminPageHeader title="Booking Rules & Policies" description="Durable policy rules stored in the backend. Booking enforcement still uses server policy code; these rules provide admin-managed configuration records." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}{notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}<AdminPanel title="Add policy rule"><form className="admin-notification-form" onSubmit={create}><label className="admin-field"><span>Name</span><input name="name" required /></label><label className="admin-field"><span>Scope</span><input name="scope" defaultValue="BOOKING" /></label><label className="admin-field"><span>Description</span><input name="description" /></label><button className="button button--primary button--small" type="submit">Create policy</button></form></AdminPanel><AdminPanel title="Policy rules"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Scope</th><th>Enabled</th><th>Description</th><th>Actions</th></tr></thead><tbody>{rows.map((p) => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.scope}</td><td><AdminStatus>{p.enabled ? 'Active' : 'Disabled'}</AdminStatus></td><td>{p.description || '—'}</td><td><div className="admin-inline-actions"><button className="button button--outline button--small" type="button" onClick={() => { void toggle(p); }}>{p.enabled ? 'Disable' : 'Enable'}</button><button className="button button--outline button--small" type="button" onClick={() => { void remove(p.id); }}><Trash2 size={13} />Delete</button></div></td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={5}>No policy rules.</td></tr>}</tbody></table></div></AdminPanel><AdminFeedback>Core booking enforcement remains server-coded (membership, venue status, lead time, operating hours, conflicts). Use these rules for durable admin configuration and future policy expansion.</AdminFeedback></section>;
}

function MaintenanceSection() {
  const [rows, setRows] = useState<ApiMaintenanceRecord[]>([]); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = async () => { try { setRows(await listMaintenance()); } catch (e) { setError(e instanceof ApiError ? e.message : 'Maintenance records could not be loaded.'); } };
  useEffect(() => { void load(); }, []);
  const create = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setError(''); setNotice(''); const fd = new FormData(e.currentTarget); try { await createMaintenance({ asset_type: String(fd.get('asset_type')), asset_label: String(fd.get('asset_label')), title: String(fd.get('title')), details: String(fd.get('details') || '') || undefined, status: String(fd.get('status') || 'SCHEDULED'), scheduled_for: String(fd.get('scheduled_for') || '') || undefined }); setNotice('Maintenance record created.'); e.currentTarget.reset(); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create record.'); } };
  const complete = async (id: string) => { try { await updateMaintenance(id, { status: 'COMPLETED' }); setNotice('Maintenance marked completed.'); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update record.'); } };
  return <section className="admin-page"><AdminPageHeader title="Maintenance Management" description="Live maintenance records for campus venues and assets." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}{notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}<AdminPanel title="Create maintenance record"><form className="admin-notification-form" onSubmit={create}><label className="admin-field"><span>Asset type</span><select name="asset_type" defaultValue="VENUE"><option value="VENUE">Venue</option><option value="EQUIPMENT">Equipment</option><option value="OTHER">Other</option></select></label><label className="admin-field"><span>Asset label</span><input name="asset_label" required /></label><label className="admin-field"><span>Title</span><input name="title" required /></label><label className="admin-field"><span>Status</span><select name="status" defaultValue="SCHEDULED"><option>SCHEDULED</option><option>IN_PROGRESS</option><option>COMPLETED</option><option>CANCELLED</option></select></label><label className="admin-field"><span>Scheduled for (optional ISO/local)</span><input name="scheduled_for" placeholder="2026-11-10T09:00" /></label><label className="admin-field"><span>Details</span><input name="details" /></label><button className="button button--primary button--small" type="submit">Create record</button></form></AdminPanel><AdminPanel title="Maintenance records"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Asset</th><th>Title</th><th>Status</th><th>Scheduled</th><th>Completed</th><th>Action</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><strong>{r.asset_label}</strong><div className="admin-muted">{r.asset_type}</div></td><td>{r.title}</td><td><AdminStatus>{r.status}</AdminStatus></td><td>{r.scheduled_for ? new Date(r.scheduled_for).toLocaleString('en-KE') : '—'}</td><td>{r.completed_at ? new Date(r.completed_at).toLocaleString('en-KE') : '—'}</td><td>{r.status !== 'COMPLETED' ? <button className="button button--outline button--small" type="button" onClick={() => { void complete(r.id); }}>Complete</button> : '—'}</td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={6}>No maintenance records.</td></tr>}</tbody></table></div></AdminPanel></section>;
}

function SystemSettingsSection() {
  const [rows, setRows] = useState<ApiSystemSetting[]>([]); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = async () => { try { setRows(await listSystemSettings()); } catch (e) { setError(e instanceof ApiError ? e.message : 'Settings could not be loaded.'); } };
  useEffect(() => { void load(); }, []);
  const save = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setError(''); setNotice(''); const fd = new FormData(e.currentTarget); const key = String(fd.get('key')); const raw = String(fd.get('value_json') || '{}'); try { const value_json = JSON.parse(raw) as Record<string, unknown>; await upsertSystemSetting({ key, value_json, description: String(fd.get('description') || '') || undefined }); setNotice(`Saved setting ${key}.`); e.currentTarget.reset(); await load(); } catch (err) { setError(err instanceof SyntaxError ? 'value_json must be valid JSON.' : err instanceof ApiError ? err.message : 'Could not save setting.'); } };
  return <section className="admin-page"><AdminPageHeader title="System Settings" description="Durable backend key/value settings (JSON)." action={<span className="admin-preview-tag">Live admin data</span>} />{error && <AdminFeedback tone="warning">{error}</AdminFeedback>}{notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}<AdminPanel title="Upsert setting"><form className="admin-notification-form" onSubmit={save}><label className="admin-field"><span>Key</span><input name="key" required placeholder="booking.notifications.enabled" /></label><label className="admin-field"><span>Description</span><input name="description" /></label><label className="admin-field"><span>Value JSON</span><textarea name="value_json" rows={4} defaultValue='{"enabled": true}' required /></label><button className="button button--primary button--small" type="submit">Save setting</button></form></AdminPanel><AdminPanel title="Stored settings"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Key</th><th>Value</th><th>Description</th><th>Updated</th></tr></thead><tbody>{rows.map((r) => <tr key={r.key}><td><span className="admin-mono">{r.key}</span></td><td><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.value_json, null, 2)}</pre></td><td>{r.description || '—'}</td><td>{new Date(r.updated_at).toLocaleString('en-KE')}</td></tr>)}{rows.length === 0 && <tr><td className="admin-empty-cell" colSpan={4}>No settings saved.</td></tr>}</tbody></table></div></AdminPanel></section>;
}

