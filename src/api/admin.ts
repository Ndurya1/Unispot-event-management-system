import { apiFetch } from './client';
import type {
  AdminAnnouncementInput,
  AdminAnnouncementResult,
  AdminRecipientGroup,
  AdminUserStatus,
  ApiAdminUser,
  ApiAllocation,
  ApiAuditEvent,
  ApiBookingAnalytics,
} from './types';

export async function listAdminUsers({ search, status, limit = 50, offset = 0 }: {
  search?: string;
  status?: AdminUserStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<ApiAdminUser[]> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  return (await apiFetch<ApiAdminUser[]>(`/admin/users?${query}`)).data;
}

export async function updateAdminUserStatus(userId: string, status: AdminUserStatus): Promise<void> {
  await apiFetch<unknown>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function assignAdminUserRole(userId: string, roleName: string): Promise<void> {
  await apiFetch<null>(`/admin/users/${userId}/roles`, {
    method: 'POST',
    body: { role_name: roleName },
  });
}

export async function removeAdminUserRole(userId: string, roleName: string): Promise<void> {
  await apiFetch<null>(`/admin/users/${userId}/roles/${encodeURIComponent(roleName)}`, {
    method: 'DELETE',
  });
}

export async function sendAdminAnnouncement(input: AdminAnnouncementInput): Promise<AdminAnnouncementResult> {
  return (await apiFetch<AdminAnnouncementResult>('/admin/notifications', {
    method: 'POST',
    body: input,
  })).data;
}

export async function getBookingAnalytics({ startsFrom, startsTo }: {
  startsFrom?: string;
  startsTo?: string;
} = {}): Promise<ApiBookingAnalytics> {
  const query = new URLSearchParams();
  if (startsFrom) query.set('starts_from', startsFrom);
  if (startsTo) query.set('starts_to', startsTo);
  const suffix = query.toString() ? `?${query}` : '';
  return (await apiFetch<ApiBookingAnalytics>(`/admin/analytics/bookings${suffix}`)).data;
}

export async function listAuditEvents({ targetType, action, limit = 100, offset = 0 }: {
  targetType?: string;
  action?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ApiAuditEvent[]> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (targetType) query.set('target_type', targetType);
  if (action) query.set('action', action);
  return (await apiFetch<ApiAuditEvent[]>(`/admin/audit?${query}`)).data;
}

export async function listAllocations({ startsFrom, startsTo, venueId, limit = 100, offset = 0 }: {
  startsFrom?: string;
  startsTo?: string;
  venueId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ApiAllocation[]> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (startsFrom) query.set('starts_from', startsFrom);
  if (startsTo) query.set('starts_to', startsTo);
  if (venueId) query.set('venue_id', venueId);
  return (await apiFetch<ApiAllocation[]>(`/admin/allocations?${query}`)).data;
}

export const adminRecipientGroups: Array<{ value: AdminRecipientGroup; label: string }> = [
  { value: 'ALL_ACTIVE', label: 'All active users' },
  { value: 'ORGANIZERS', label: 'Organizers' },
  { value: 'VENUE_ADMINS', label: 'Venue administrators' },
  { value: 'SYSTEM_ADMINS', label: 'System administrators' },
];
