import { clearTokens, getAccessToken, getRefreshToken, saveAccessToken } from '../auth/storage';
import type { ApiErrorPayload, ApiResult, TokenResponse } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code: string;
  details: Array<Record<string, unknown>>;
  requestId: string | null;
  retryAfter: number | null;

  constructor(status: number, payload: ApiErrorPayload | null, requestId: string | null, retryAfter: string | null) {
    super(payload?.error?.message || 'The request could not be completed.');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.error?.code || 'request_failed';
    this.details = payload?.error?.details || [];
    this.requestId = requestId || payload?.error?.request_id || null;
    this.retryAfter = retryAfter ? Number(retryAfter) : null;
  }
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & { body?: unknown };

function buildRequestBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob || typeof body === 'string') {
    return body;
  }
  headers.set('Content-Type', 'application/json');
  return JSON.stringify(body);
}

async function sendRequest<T>(path: string, options: ApiFetchOptions, includeAuth: boolean): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (includeAuth) {
    const accessToken = getAccessToken();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    body: buildRequestBody(options.body, headers),
    headers,
  });
  const requestId = response.headers.get('X-Request-ID');
  const retryAfter = response.headers.get('Retry-After');
  const contentType = response.headers.get('content-type') || '';
  const payload = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json()
      : null;

  if (!response.ok) {
    throw new ApiError(response.status, payload, requestId, retryAfter);
  }

  return { data: payload as T, requestId, response };
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const isAuthenticationRequest = ['/auth/login', '/auth/register', '/auth/token', '/auth/refresh'].includes(path);
  try {
    return await sendRequest<T>(path, options, !isAuthenticationRequest);
  } catch (error) {
    const refreshToken = getRefreshToken();
    const canRefresh = error instanceof ApiError
      && error.status === 401
      && Boolean(refreshToken)
      && !isAuthenticationRequest;

    if (!canRefresh) throw error;

    try {
      const refresh = await sendRequest<TokenResponse>('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken },
      }, false);
      saveAccessToken(refresh.data.access_token);
      return await sendRequest<T>(path, options, true);
    } catch (refreshError) {
      clearTokens();
      throw refreshError;
    }
  }
}
