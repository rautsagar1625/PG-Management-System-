import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const json = await res.json();

  if (!res.ok) {
    const message = json?.message ?? json?.error ?? `Request failed: ${res.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return json;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
};
