'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { JwtPayload } from '@sentient/shared';
import { authStore } from '@/lib/auth';
import { logout as apiLogout } from '@/lib/api/hr-core';

interface AuthContextValue {
  user: JwtPayload | null;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<JwtPayload | null>(null);

  useEffect(() => {
    setUser(authStore.getPayload());
  }, []);

  const login = useCallback((accessToken: string, refreshToken: string) => {
    authStore.set(accessToken, refreshToken);
    // Set a thin cookie for middleware (no sensitive data)
    document.cookie = 'sentient_logged_in=1; path=/; SameSite=Lax';
    setUser(authStore.getPayload());
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* best-effort */ }
    authStore.clear();
    document.cookie = 'sentient_logged_in=; path=/; max-age=0';
    setUser(null);
    window.location.replace('/login');
  }, []);

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
