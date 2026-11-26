'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, UserRole } from '@/types/telephony';
import {
  apiFetch,
  extractApiError,
  parseRetryAfterSeconds,
  refreshSessionWithLock,
  registerAuthCallbacks,
} from '@/lib/api-client';

export type LoginResult = {
  ok: boolean;
  error?: string;
  retryAfterSeconds?: number;
};

interface AuthContextType {
  user: AuthUser | null;
  authLoading: boolean;
  authNotice: string | null;
  serverError: string | null;
  isChangePasswordOpen: boolean;
  openChangePassword: () => void;
  closeChangePassword: () => void;
  clearAuthNotice: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  onPasswordChanged: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authLoading: true,
  authNotice: null,
  serverError: null,
  isChangePasswordOpen: false,
  openChangePassword: () => {},
  closeChangePassword: () => {},
  clearAuthNotice: () => {},
  hasRole: () => false,
  login: async () => ({ ok: false }),
  logout: async () => {},
  refreshProfile: async () => {},
  onPasswordChanged: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setIsChangePasswordOpen(false);
  }, []);

  useEffect(() => {
    registerAuthCallbacks({
      onUserUpdated: (updatedUser) => {
        setUser(updatedUser);
      },
      onSessionExpired: handleSessionExpired,
    });
  }, [handleSessionExpired]);

  const refreshProfile = useCallback(async () => {
    setAuthLoading(true);
    setServerError(null);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data?.user ?? data);
        return;
      }

      if (res.status === 401) {
        const refreshed = await refreshSessionWithLock();
        if (!refreshed) {
          setUser(null);
        }
        return;
      }

      setServerError(`Сервер авторизации вернул статус ${res.status}`);
      setUser(null);
    } catch {
      setServerError('Не удалось связаться с сервером телефонии');
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    setAuthNotice(null);
    setServerError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-SAVT-CSRF': '1',
        },
        body: JSON.stringify({ username, password }),
      });

      if (res.status === 429) {
        const retryAfterSeconds = parseRetryAfterSeconds(res.headers.get('Retry-After'));
        const detail = await extractApiError(
          res,
          `Слишком много попыток входа. Подождите ${retryAfterSeconds} сек.`
        );
        return { ok: false, error: detail, retryAfterSeconds };
      }

      if (!res.ok) {
        const detail = await extractApiError(res, 'Неверный логин или пароль');
        return { ok: false, error: detail };
      }

      const data = await res.json();
      const profile: AuthUser = data?.user ?? data;
      if (profile && profile.username && profile.role) {
        setUser(profile);
      } else {
        await refreshProfile();
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Не удалось связаться с сервером для входа' };
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout and always clear local state
    } finally {
      setUser(null);
      setIsChangePasswordOpen(false);
      setAuthNotice(null);
    }
  };

  const onPasswordChanged = () => {
    setUser(null);
    setIsChangePasswordOpen(false);
    setAuthNotice('Пароль успешно изменён. Войдите с новым паролем.');
  };

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        authNotice,
        serverError,
        isChangePasswordOpen,
        openChangePassword: () => setIsChangePasswordOpen(true),
        closeChangePassword: () => setIsChangePasswordOpen(false),
        clearAuthNotice: () => setAuthNotice(null),
        hasRole,
        login,
        logout,
        refreshProfile,
        onPasswordChanged,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
