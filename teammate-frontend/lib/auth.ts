/**
 * Auth helpers that talk to the fixed-backend gateway.
 *
 * Storage strategy:
 *   - Access token: in memory + sessionStorage (see lib/auth-client.ts).
 *   - Refresh token: HttpOnly cookie set by the gateway; we never see it.
 *   - User profile: cached in `sessionStorage` so dashboard pages can render
 *     immediately after a hard refresh.
 *
 * After signIn / signUp the caller is expected to:
 *   1. setAccessToken(accessToken, user.id)
 *   2. router.push('/dashboard#access_token=…&user_id=…')
 *      so the dashboard layout picks up the session through the same
 *      hash-based path Google uses.
 */

import {
  setAccessToken as setAccessTokenClient,
} from './auth-client';

// `clearSession` is just setAccessToken(null, null) — keep the call site short.

const SESSION_KEY = 'aibridge:user';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'BUSINESS_OWNER' | 'EMPLOYEE';
  isVerified?: boolean;
}

function readCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    window.sessionStorage.removeItem(SESSION_KEY);
  }
}

// Minimal fetch wrapper that always includes credentials and surfaces the
// access token. The 401-refresh-and-retry logic lives in api.ts.
async function rawApi<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders } = init
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extraHeaders || {}),
  }
  let bodyOut: BodyInit | undefined
  if (body == null) {
    bodyOut = undefined
  } else if (body instanceof FormData) {
    bodyOut = body
  } else {
    headers['Content-Type'] = 'application/json'
    bodyOut = JSON.stringify(body)
  }
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: bodyOut,
  })
  const text = await res.text()
  const data: unknown = text ? safeJson(text) : null
  if (!res.ok) {
    const errBody = (data as { error?: string; details?: unknown } | null) ?? null
    throw new Error(errBody?.error ?? `Request failed with status ${res.status}`)
  }
  return data as T
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export async function signUp(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ user: AuthUser; accessToken: string }> {
  // /api/auth/register returns { user } only; we follow it with /login to
  // get the access token + cookie in one round-trip from the client.
  await rawApi<{ user: AuthUser; success: boolean }>('/api/auth/signup', {
    method: 'POST',
    body: input,
  });
  return signIn({ email: input.email, password: input.password });
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; accessToken: string }> {
  const data = await rawApi<{ accessToken: string; user: AuthUser }>(
    '/api/auth/signin',
    { method: 'POST', body: input },
  );
  setAccessTokenClient(data.accessToken, data.user.id);
  cacheUser(data.user);
  return { user: data.user, accessToken: data.accessToken };
}

export async function signInWithGoogle(credential: string): Promise<AuthUser> {
  const data = await rawApi<{ accessToken: string; user: AuthUser }>(
    '/api/auth/google',
    { method: 'POST', body: { credential } },
  );
  setAccessTokenClient(data.accessToken, data.user.id);
  cacheUser(data.user);
  return data.user;
}

export async function signOut(): Promise<void> {
  try {
    await rawApi('/api/auth/signout', { method: 'POST' });
  } finally {
    setAccessTokenClient(null, null);
    cacheUser(null);
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await rawApi<{ user: AuthUser }>('/api/auth/me');
    cacheUser(data.user);
    return data.user;
  } catch {
    return readCachedUser();
  }
}

export function currentCachedUser(): AuthUser | null {
  return readCachedUser();
}
