import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? 'http://localhost:3001/api/v1' : 'https://api.pgmanager.app/api/v1');

const KEYS = {
  ACCESS_TOKEN: 'pg_access_token',
  REFRESH_TOKEN: 'pg_refresh_token',
  USER: 'pg_user',
} as const;

// Callback set by the auth layer to navigate to the login screen on forced logout
let onForceLogout: (() => void) | null = null;
export function setForceLogoutHandler(cb: () => void) {
  onForceLogout = cb;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const { accessToken, refreshToken: newRefreshToken } = json.data;

    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
    if (newRefreshToken) {
      await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, newRefreshToken);
    }

    return accessToken as string;
  } catch {
    return null;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.USER);
  onForceLogout?.();
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = await getValidAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401 && !isRetry) {
    // Deduplicate concurrent 401 retries — only one refresh in flight at a time
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (!newToken) {
      await clearSession();
      throw new Error('Session expired. Please log in again.');
    }

    return request<T>(path, options, true);
  }

  const json = await res.json();

  if (!res.ok) {
    const message =
      json?.error?.message ??
      json?.message ??
      (typeof json?.error === 'string' ? json.error : null) ??
      `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return json;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
