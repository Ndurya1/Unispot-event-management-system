import { apiFetch } from './client';
import type { AuthCredentials, CurrentUser, RegistrationDetails, TokenResponse } from './types';

export async function login(credentials: AuthCredentials): Promise<TokenResponse> {
  return (await apiFetch<TokenResponse>('/auth/login', { method: 'POST', body: credentials })).data;
}

export async function register(details: RegistrationDetails): Promise<TokenResponse> {
  return (await apiFetch<TokenResponse>('/auth/register', { method: 'POST', body: details })).data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return (await apiFetch<CurrentUser>('/auth/me')).data;
}
