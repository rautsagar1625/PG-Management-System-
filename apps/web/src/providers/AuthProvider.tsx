'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { clearTokens, getAccessToken, setTokens } from '@/lib/api';
import { getCurrentUser, login, logout, register } from '@/lib/auth-api';
import type { LoginDto, RegisterDto } from '@/lib/auth-api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  systemRole: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (dto: LoginDto) => Promise<void>;
  signUp: (dto: RegisterDto) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signIn = async (dto: LoginDto) => {
    const { user: authUser, tokens } = await login(dto);
    setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(authUser);
  };

  const signUp = async (dto: RegisterDto) => {
    const { user: authUser, tokens } = await register(dto);
    setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(authUser);
  };

  const signOut = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch {
        // logout failure should not block client-side cleanup
      }
    }
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
