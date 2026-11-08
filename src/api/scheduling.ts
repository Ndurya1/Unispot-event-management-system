import { apiFetch } from './client';
import type { ApiRecurringSchedule, ApiWaitlist, CreateRecurringInput, CreateWaitlistInput, RecurringStatus } from './types';

function createIdempotencyKey(): string { return crypto.randomUUID(); }

export async function listAllWaitlists() { return (await apiFetch<ApiWaitlist[]>('/scheduling/waitlists')).data; }
export async function listAllRecurring() { return (await apiFetch<ApiRecurringSchedule[]>('/scheduling/recurring')).data; }
export async function listMyWaitlists() { return (await apiFetch<ApiWaitlist[]>('/scheduling/waitlists/me')).data; }
export async function createWaitlist(input: CreateWaitlistInput, idempotencyKey = createIdempotencyKey()) {
  return (await apiFetch<ApiWaitlist>('/scheduling/waitlists', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: input })).data;
}
export async function cancelWaitlist(waitlistId: string) {
  return (await apiFetch<ApiWaitlist>(`/scheduling/waitlists/${waitlistId}/cancel`, { method: 'POST' })).data;
}

export async function listMyRecurring() { return (await apiFetch<ApiRecurringSchedule[]>('/scheduling/recurring/me')).data; }
export async function createRecurring(input: CreateRecurringInput, idempotencyKey = createIdempotencyKey()) {
  return (await apiFetch<ApiRecurringSchedule>('/scheduling/recurring', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: input })).data;
}
export async function updateRecurring(recurringId: string, status: RecurringStatus) {
  return (await apiFetch<ApiRecurringSchedule>(`/scheduling/recurring/${recurringId}`, { method: 'PATCH', body: { status } })).data;
}
