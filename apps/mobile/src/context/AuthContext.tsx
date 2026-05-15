import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredUser, type AuthUser } from '../lib/auth';

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

  useEffect(() => {
    getStoredUser()
      .then(setUser)
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
