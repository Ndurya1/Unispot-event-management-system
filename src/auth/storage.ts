import type { TokenResponse } from '../api/types';

const ACCESS_TOKEN_KEY = 'unispot.access_token';
const REFRESH_TOKEN_KEY = 'unispot.refresh_token';

type TokenStorage = Storage;

function readStorage(storage: TokenStorage): TokenResponse | null {
  const accessToken = storage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
  return accessToken && refreshToken
    ? { access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer' }
    : null;
}

export function getTokens(): TokenResponse | null {
  return readStorage(window.localStorage) ?? readStorage(window.sessionStorage);
}

export function getAccessToken(): string | null {
  return getTokens()?.access_token ?? null;
}

export function getRefreshToken(): string | null {
  return getTokens()?.refresh_token ?? null;
}

export function saveTokens(tokens: TokenResponse, rememberMe: boolean): void {
  clearTokens();
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function saveAccessToken(accessToken: string): void {
  const storage = window.localStorage.getItem(REFRESH_TOKEN_KEY)
    ? window.localStorage
    : window.sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearTokens(): void {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  }
}
