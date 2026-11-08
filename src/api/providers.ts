import { apiFetch } from './client';
import type { ApiServiceProvider, ApiServiceRequest, ServiceRequestStatus } from './types';

export async function listServiceProviders() { return (await apiFetch<ApiServiceProvider[]>('/providers')).data; }
export async function listServiceProvidersAdmin() { return (await apiFetch<ApiServiceProvider[]>('/providers/admin/all')).data; }
export async function createServiceProviderAdmin(payload: Partial<ApiServiceProvider>) { return (await apiFetch<ApiServiceProvider>('/providers/admin', { method: 'POST', body: payload })).data; }
export async function updateServiceProviderAdmin(providerId: string, payload: Partial<ApiServiceProvider>) { return (await apiFetch<ApiServiceProvider>(`/providers/admin/${providerId}`, { method: 'PATCH', body: payload })).data; }
export async function getMyProviderProfile() { return (await apiFetch<ApiServiceProvider | null>('/providers/me/profile')).data; }
export async function createMyProviderProfile(payload: Partial<ApiServiceProvider>) { return (await apiFetch<ApiServiceProvider>('/providers/me/profile', { method: 'POST', body: payload })).data; }

export async function createServiceRequest(payload: { provider_id: string; event_name: string; requested_date: string; notes?: string }, idempotencyKey: string) {
  return (await apiFetch<ApiServiceRequest>('/providers/requests', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: payload })).data;
}
export async function listMyServiceRequests() { return (await apiFetch<ApiServiceRequest[]>('/providers/requests')).data; }
export async function cancelMyServiceRequest(requestId: string) { return (await apiFetch<ApiServiceRequest>(`/providers/requests/${requestId}/cancel`, { method: 'POST' })).data; }
export async function listServiceRequestsAdmin() { return (await apiFetch<ApiServiceRequest[]>('/providers/requests/admin')).data; }
export async function assignServiceRequestAdmin(requestId: string, assignedProviderId: string | null) { return (await apiFetch<ApiServiceRequest>(`/providers/requests/admin/${requestId}/assign`, { method: 'POST', body: { assigned_provider_id: assignedProviderId } })).data; }
export async function updateServiceRequestStatusAdmin(requestId: string, status: ServiceRequestStatus) { return (await apiFetch<ApiServiceRequest>(`/providers/requests/admin/${requestId}/status`, { method: 'POST', body: { status } })).data; }
export async function listAssignedServiceRequests() { return (await apiFetch<ApiServiceRequest[]>('/providers/requests/assigned')).data; }
export async function updateAssignedServiceRequestStatus(requestId: string, status: ServiceRequestStatus) { return (await apiFetch<ApiServiceRequest>(`/providers/requests/assigned/${requestId}/status`, { method: 'POST', body: { status } })).data; }
export async function quoteAssignedServiceRequest(requestId: string, payload: { quote_amount_kes?: number | null; quote_notes?: string | null }) { return (await apiFetch<ApiServiceRequest>(`/providers/requests/assigned/${requestId}/quote`, { method: 'POST', body: payload })).data; }
