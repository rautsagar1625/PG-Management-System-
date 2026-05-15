import AsyncStorage from '@react-native-async-storage/async-storage';
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

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await api.post<{ success: boolean; data: LoginResult }>('/auth/login', {
    email,
    password,
  });
  const { accessToken, refreshToken, user } = res.data;
  await AsyncStorage.setItem('access_token', accessToken);
  await AsyncStorage.setItem('refresh_token', refreshToken);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  return { accessToken, refreshToken, user };
}

export async function logout(): Promise<void> {
  const refreshToken = await AsyncStorage.getItem('refresh_token');
  if (refreshToken) {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore logout errors
    }
  }
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}
