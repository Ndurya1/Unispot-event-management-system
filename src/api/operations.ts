import { apiFetch } from './client';
import type { ApiMaintenanceRecord, ApiPolicyRule, ApiSystemSetting } from './types';

export async function listSystemSettings(): Promise<ApiSystemSetting[]> { return (await apiFetch<ApiSystemSetting[]>('/admin/settings')).data; }
export async function upsertSystemSetting(data: { key: string; value_json: Record<string, unknown>; description?: string }): Promise<ApiSystemSetting> { return (await apiFetch<ApiSystemSetting>('/admin/settings', { method: 'PUT', body: data })).data; }
export async function listPolicies(scope?: string): Promise<ApiPolicyRule[]> { return (await apiFetch<ApiPolicyRule[]>(`/admin/policies${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`)).data; }
export async function createPolicy(data: Partial<ApiPolicyRule> & { name: string }): Promise<ApiPolicyRule> { return (await apiFetch<ApiPolicyRule>('/admin/policies', { method: 'POST', body: data })).data; }
export async function updatePolicy(id: string, data: Partial<ApiPolicyRule>): Promise<ApiPolicyRule> { return (await apiFetch<ApiPolicyRule>(`/admin/policies/${id}`, { method: 'PATCH', body: data })).data; }
export async function deletePolicy(id: string): Promise<void> { await apiFetch<null>(`/admin/policies/${id}`, { method: 'DELETE' }); }
export async function listMaintenance(status?: string): Promise<ApiMaintenanceRecord[]> { return (await apiFetch<ApiMaintenanceRecord[]>(`/admin/maintenance${status ? `?status=${encodeURIComponent(status)}` : ''}`)).data; }
export async function createMaintenance(data: Partial<ApiMaintenanceRecord> & { asset_type: string; asset_label: string; title: string }): Promise<ApiMaintenanceRecord> { return (await apiFetch<ApiMaintenanceRecord>('/admin/maintenance', { method: 'POST', body: data })).data; }
export async function updateMaintenance(id: string, data: Partial<ApiMaintenanceRecord>): Promise<ApiMaintenanceRecord> { return (await apiFetch<ApiMaintenanceRecord>(`/admin/maintenance/${id}`, { method: 'PATCH', body: data })).data; }
