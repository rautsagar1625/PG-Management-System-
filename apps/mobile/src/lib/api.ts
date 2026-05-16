import AsyncStorage from '@react-native-async-storage/async-storage';

// Use __DEV__ to avoid babel-preset-expo's virtual module injection from process.env.EXPO_PUBLIC_*
const API_BASE_URL = __DEV__
  ? 'http://localhost:3001/api/v1'
  : 'https://api.pgmanager.app/api/v1';

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
};
