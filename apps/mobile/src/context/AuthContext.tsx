import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getStoredUser, type AuthUser } from '../lib/auth';
import { setForceLogoutHandler } from '../lib/api';
import { registerPushToken, clearPushToken } from '../lib/push';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const forceLogout = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    setForceLogoutHandler(forceLogout);
  }, [forceLogout]);

  useEffect(() => {
    getStoredUser()
      .then((u) => {
        setUser(u);
        if (u) registerPushToken(); // best-effort; never throws
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
