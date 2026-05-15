/**
 * Lightweight API client for setting up E2E test fixtures.
 * Uses the REST API directly (not through the browser) for speed.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const body = (await res.json()) as { data: { tokens: { accessToken: string } } };
  return body.data.tokens.accessToken;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export async function apiPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}
