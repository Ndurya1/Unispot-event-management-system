import { apiFetch } from './client';
import type {
  ApiEquipmentAvailability,
  ApiEquipmentReservation,
  CreateEquipmentReservationInput,
} from './types';

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export type ApiEquipmentItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  total_quantity: number;
  status: string;
};

export async function listEquipmentItems() {
  return (await apiFetch<ApiEquipmentItem[]>('/equipment/items')).data;
}

export async function createEquipmentItem(input: { slug: string; name: string; description?: string; total_quantity: number; status?: string }) {
  return (await apiFetch<ApiEquipmentItem>('/equipment/items', { method: 'POST', body: input })).data;
}

export async function updateEquipmentItem(itemId: string, input: Partial<{ name: string; description: string | null; total_quantity: number; status: string }>) {
  return (await apiFetch<ApiEquipmentItem>(`/equipment/items/${itemId}`, { method: 'PATCH', body: input })).data;
}

export async function listAllEquipmentReservations() {
  return (await apiFetch<ApiEquipmentReservation[]>('/equipment/reservations')).data;
}

export async function listEquipmentAvailability(startsAt: string, endsAt: string) {
  const query = new URLSearchParams({ starts_at: startsAt, ends_at: endsAt });
  return (await apiFetch<ApiEquipmentAvailability[]>(`/equipment/availability?${query}`)).data;
}

export async function createEquipmentReservation(
  input: CreateEquipmentReservationInput,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return (await apiFetch<ApiEquipmentReservation>('/equipment/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: input,
  })).data;
}

export async function listMyEquipmentReservations() {
  return (await apiFetch<ApiEquipmentReservation[]>('/equipment/reservations/me')).data;
}
