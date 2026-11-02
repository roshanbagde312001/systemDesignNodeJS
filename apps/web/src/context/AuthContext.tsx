import { Box, CircularProgress } from '@mui/material';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { HttpError, request } from '../data/api';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor';
}

interface AuthState {
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Authenticated request that transparently refreshes an expired access token once. */
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** Tries to restore a session from the refresh cookie. */
  restore: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * The short-lived access token lives only in memory (never localStorage) to limit XSS exposure.
 * The refresh token is an httpOnly, SameSite=Strict cookie set by the API and rotated on every refresh.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const token = useRef<string | null>(null);
  const refreshing = useRef<Promise<boolean> | null>(null);

  const refresh = useCallback(async () => {
    // Coalesce concurrent refreshes so a rotated refresh token is only used once.
    refreshing.current ??= request<{ accessToken: string; user: AdminUser }>('/auth/refresh', { method: 'POST' })
      .then((r) => {
        token.current = r.accessToken;
        setUser(r.user);
        return true;
      })
      .catch(() => {
        token.current = null;
        setUser(null);
        return false;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await request<{ accessToken: string; user: AdminUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    token.current = r.accessToken;
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      token.current = null;
      setUser(null);
    }
  }, []);

  const authFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      try {
        return await request<T>(path, { ...init, token: token.current ?? undefined });
      } catch (err) {
        if (err instanceof HttpError && err.status === 401 && (await refresh())) {
          return request<T>(path, { ...init, token: token.current ?? undefined });
        }
        throw err;
      }
    },
    [refresh],
  );

  const value = useMemo(() => ({ user, login, logout, authFetch, restore: refresh }), [user, login, logout, authFetch, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Guards admin routes. Public pages never call the auth API; only admin routes try to restore a session. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, restore } = useAuth();
  const location = useLocation();
  const [checked, setChecked] = useState(!!user);
  useEffect(() => {
    if (user) return setChecked(true);
    let active = true;
    restore().finally(() => active && setChecked(true));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!checked) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress aria-label="Checking session" />
      </Box>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
