import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCurrentUser, login as loginRequest, register as registerRequest } from '../api/auth';
import type { AuthCredentials, CurrentUser, RegisterResponse, RegistrationDetails } from '../api/types';
import { ApiError } from '../api/client';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './storage';

type AuthContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authCheckError: string | null;
  login: (credentials: AuthCredentials, rememberMe: boolean) => Promise<CurrentUser>;
  register: (details: RegistrationDetails) => Promise<RegisterResponse>;
  logout: () => void;
  reloadUser: () => Promise<CurrentUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCheckError, setAuthCheckError] = useState<string | null>(null);

  const reloadUser = async (): Promise<CurrentUser | null> => {
    if (!getAccessToken() && !getRefreshToken()) {
      setUser(null);
      setAuthCheckError(null);
      return null;
    }
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setAuthCheckError(null);
      return currentUser;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearTokens();
        setUser(null);
        setAuthCheckError(null);
      } else {
        // Transient/network error: keep tokens and avoid forcing logout/login redirect.
        setAuthCheckError(error instanceof Error ? error.message : 'Session check failed');
      }
      throw error;
    }
  };

  useEffect(() => {
    reloadUser()
      .catch((error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) clearTokens();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: user !== null,
    authCheckError,
    login: async (credentials, rememberMe) => {
      const tokens = await loginRequest(credentials);
      saveTokens(tokens, rememberMe);
      try {
        return (await reloadUser()) as CurrentUser;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearTokens();
          setUser(null);
        }
        throw error;
      }
    },
    register: async (details) => registerRequest(details),
    logout: () => {
      clearTokens();
      setUser(null);
      setAuthCheckError(null);
    },
    reloadUser,
  }), [authCheckError, isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
