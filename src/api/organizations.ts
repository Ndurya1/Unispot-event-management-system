import { apiFetch } from './client';

export type ApiOrganization = { id: string; name: string; slug: string; organization_type: string; status: string };
export type ApiMembership = { id: string; user_id: string; organization_id: string; membership_role: 'MEMBER' | 'ORGANIZER'; status: 'ACTIVE' | 'INACTIVE' };

export async function listOrganizations() {
  return (await apiFetch<ApiOrganization[]>('/organizations')).data;
}
export async function listPublicOrganizations() {
  return (await apiFetch<ApiOrganization[]>('/organizations/public')).data;
}
export async function createOrganization(input: { name: string; slug: string; organization_type: string }) {
  return (await apiFetch<ApiOrganization>('/organizations', { method: 'POST', body: input })).data;
}
export async function addOrganizationMember(organizationId: string, input: { user_id: string; membership_role: 'MEMBER' | 'ORGANIZER' }) {
  return (await apiFetch<ApiMembership>(`/organizations/${organizationId}/members`, { method: 'POST', body: input })).data;
}
