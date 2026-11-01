import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCurrentUser, login as loginRequest, register as registerRequest } from '../api/auth';
import type { AuthCredentials, CurrentUser, RegistrationDetails } from '../api/types';
import { ApiError } from '../api/client';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './storage';

type AuthContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: AuthCredentials, rememberMe: boolean) => Promise<CurrentUser>;
  register: (details: RegistrationDetails, rememberMe?: boolean) => Promise<CurrentUser>;
  logout: () => void;
  reloadUser: () => Promise<CurrentUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reloadUser = async (): Promise<CurrentUser | null> => {
    if (!getAccessToken() && !getRefreshToken()) {
      setUser(null);
      return null;
    }
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearTokens();
        setUser(null);
      }
      throw error;
    }
  };

  useEffect(() => {
    reloadUser().catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: user !== null,
    login: async (credentials, rememberMe) => {
      const tokens = await loginRequest(credentials);
      saveTokens(tokens, rememberMe);
      try {
        return (await reloadUser()) as CurrentUser;
      } catch (error) {
        clearTokens();
        setUser(null);
        throw error;
      }
    },
    register: async (details, rememberMe = true) => {
      const tokens = await registerRequest(details);
      saveTokens(tokens, rememberMe);
      try {
        return (await reloadUser()) as CurrentUser;
      } catch (error) {
        clearTokens();
        setUser(null);
        throw error;
      }
    },
    logout: () => {
      clearTokens();
      setUser(null);
    },
    reloadUser,
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
