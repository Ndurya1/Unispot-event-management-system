import { apiFetch } from './client';
import type { ApiCampusEvent, ApiEventAttendance, ApiEventRegistration, CreateCampusEventInput, CreateEventRegistrationInput } from './types';

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function listCampusEvents() {
  return (await apiFetch<ApiCampusEvent[]>('/events')).data;
}

export async function createCampusEvent(input: CreateCampusEventInput) {
  return (await apiFetch<ApiCampusEvent>('/events', { method: 'POST', body: input })).data;
}

export async function listAdminEvents(includeCancelled = true) {
  const query = new URLSearchParams({ include_cancelled: String(includeCancelled), limit: '500' });
  return (await apiFetch<ApiCampusEvent[]>(`/events/admin?${query}`)).data;
}

export async function listManageableEvents() {
  return (await apiFetch<ApiCampusEvent[]>('/events/manage')).data;
}

export async function updateCampusEvent(eventId: string, input: Partial<CreateCampusEventInput>) {
  return (await apiFetch<ApiCampusEvent>(`/events/${eventId}`, { method: 'PATCH', body: input })).data;
}

export async function cancelCampusEvent(eventId: string) {
  return (await apiFetch<ApiCampusEvent>(`/events/${eventId}/cancel`, { method: 'POST' })).data;
}

export async function createEventRegistration(
  input: CreateEventRegistrationInput,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return (await apiFetch<ApiEventRegistration>('/events/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: input,
  })).data;
}

export async function listAllEventRegistrations() {
  return (await apiFetch<ApiEventRegistration[]>('/events/registrations')).data;
}

export async function listMyEventRegistrations() {
  return (await apiFetch<ApiEventRegistration[]>('/events/registrations/me')).data;
}

export async function listEventRegistrationsForManagement(eventId: string) {
  return (await apiFetch<ApiEventRegistration[]>(`/events/${eventId}/registrations`)).data;
}

export async function checkInEventRegistration(registrationId: string) {
  return (await apiFetch<ApiEventRegistration>(`/events/registrations/${registrationId}/check-in`, { method: 'POST' })).data;
}

export async function getEventAttendance(eventId: string) {
  return (await apiFetch<ApiEventAttendance>(`/events/${eventId}/attendance`)).data;
}
