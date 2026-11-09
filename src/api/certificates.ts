import { apiFetch } from './client';
import type { ApiCertificate, ApiCertificateVerification } from './types';

export async function listMyCertificates(): Promise<ApiCertificate[]> { return (await apiFetch<ApiCertificate[]>('/certificates/me')).data; }
export async function issueCertificate(registrationId: string, templateName = 'Campus Classic'): Promise<ApiCertificate> { return (await apiFetch<ApiCertificate>('/certificates/issue', { method: 'POST', body: { registration_id: registrationId, template_name: templateName } })).data; }
export async function verifyCertificate(code: string): Promise<ApiCertificateVerification> { return (await apiFetch<ApiCertificateVerification>(`/certificates/verify/${encodeURIComponent(code)}`)).data; }
export async function listAdminCertificates(): Promise<ApiCertificate[]> { return (await apiFetch<ApiCertificate[]>('/admin/certificates')).data; }
export async function revokeCertificate(id: string, reason?: string): Promise<ApiCertificate> { const q = reason ? `?reason=${encodeURIComponent(reason)}` : ''; return (await apiFetch<ApiCertificate>(`/admin/certificates/${id}/revoke${q}`, { method: 'POST' })).data; }
