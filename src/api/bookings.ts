import { apiFetch } from './client';
import type { ApiBooking, BookingStatus, CreateBookingInput } from './types';

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function listMyBookings(params: {
  status?: BookingStatus;
  startsFrom?: string;
  startsTo?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.startsFrom) query.set('starts_from', params.startsFrom);
  if (params.startsTo) query.set('starts_to', params.startsTo);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  return (await apiFetch<ApiBooking[]>(`/bookings/me?${query}`)).data;
}

export async function createBooking(input: CreateBookingInput, idempotencyKey: string = createIdempotencyKey()) {
  return (await apiFetch<ApiBooking>('/bookings', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: input,
  })).data;
}

export async function cancelBooking(bookingId: string, reason?: string, idempotencyKey: string = createIdempotencyKey()) {
  return (await apiFetch<ApiBooking>(`/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: { reason },
  })).data;
}

export async function listAdminBookings(params: { status?: BookingStatus; venueId?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 100), offset: String(params.offset ?? 0) });
  if (params.status) query.set('status', params.status);
  if (params.venueId) query.set('venue_id', params.venueId);
  return (await apiFetch<ApiBooking[]>(`/admin/bookings?${query}`)).data;
}

export async function adminCancelBooking(bookingId: string, reason?: string, idempotencyKey: string = createIdempotencyKey()) {
  return (await apiFetch<ApiBooking>(`/admin/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: { reason },
  })).data;
}
