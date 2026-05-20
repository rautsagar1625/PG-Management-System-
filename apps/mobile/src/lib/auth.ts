import * as SecureStore from 'expo-secure-store';
import { api } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const KEYS = {
  ACCESS_TOKEN: 'pg_access_token',
  REFRESH_TOKEN: 'pg_refresh_token',
  USER: 'pg_user',
} as const;

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await api.post<{
    success: boolean;
    data: { user: AuthUser; tokens: { accessToken: string; refreshToken: string } };
  }>('/auth/login', { email, password });
  const { user, tokens } = res.data;
  const { accessToken, refreshToken } = tokens;
  await storeTokens(accessToken, refreshToken, user);
  return { accessToken, refreshToken, user };
}

export async function logout(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  if (refreshToken) {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore logout errors — local cleanup proceeds regardless
    }
  }
  await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.USER);
}

export async function storeTokens(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
  await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}
