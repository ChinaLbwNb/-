import { useState, useCallback, useEffect } from 'react';
import type { User } from '@/types';

const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const resolved = raw ? new URL(raw, window.location.origin).toString() : null;
  const fallback = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;
  return (resolved ?? fallback).replace(/\/$/, '');
})();

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuthStore() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok && data.user) {
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, rememberMe }),
    });
    const data = await res.json();
    if (data.ok) {
      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
      });
    }
    return data;
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, email }),
    });
    return res.json();
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    return res.json();
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const res = await fetch(`${API_BASE}/api/auth/update-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.ok && state.user) {
      setState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, email } : null,
      }));
    }
    return data;
  }, [state.user]);

  return {
    ...state,
    login,
    register,
    logout,
    changePassword,
    updateEmail,
    checkAuth,
  };
}
