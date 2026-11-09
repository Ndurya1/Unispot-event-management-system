import { apiFetch } from './client';
import type { AuthCredentials, CurrentUser, MessageResponse, RegisterResponse, RegistrationDetails, TokenResponse } from './types';

export async function login(credentials: AuthCredentials): Promise<TokenResponse> {
  return (await apiFetch<TokenResponse>('/auth/login', { method: 'POST', body: credentials })).data;
}

export async function register(details: RegistrationDetails): Promise<RegisterResponse> {
  return (await apiFetch<RegisterResponse>('/auth/register', { method: 'POST', body: details })).data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return (await apiFetch<CurrentUser>('/auth/me')).data;
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  return (await apiFetch<MessageResponse>('/auth/forgot-password', { method: 'POST', body: { email } })).data;
}

export async function resetPassword(token: string, new_password: string): Promise<MessageResponse> {
  return (await apiFetch<MessageResponse>('/auth/reset-password', { method: 'POST', body: { token, new_password } })).data;
}

export async function verifyEmail(token: string): Promise<MessageResponse> {
  return (await apiFetch<MessageResponse>('/auth/verify-email', { method: 'POST', body: { token } })).data;
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  return (await apiFetch<MessageResponse>('/auth/resend-verification', { method: 'POST', body: { email } })).data;
}

export async function deleteMyAccount(): Promise<void> {
  await apiFetch<void>('/auth/me', { method: 'DELETE' });
}
