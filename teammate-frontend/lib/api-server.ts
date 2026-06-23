/**
 * Server-side proxy helper.
 *
 * The teammate-frontend Next.js app proxies /api/* to the fixed-backend
 * Express gateway (see next.config.mjs rewrites). The browser treats
 * these as same-origin, so cookies + Authorization both ride along on
 * the browser → Next.js leg.
 *
 * But the Next.js → backend leg is cross-origin. Each route.ts proxy
 * has to manually copy BOTH:
 *
 *   1. The Authorization header from the browser (the access token
 *      lives in localStorage, so the browser sets it; we just forward).
 *   2. The refreshToken cookie from the browser (the refresh token is
 *      HttpOnly and set by the gateway, so the browser sends it via
 *      credentials: 'include' on the same-origin rewrite; we read it
 *      via next/headers and re-emit it as a Cookie header on the
 *      server-side fetch).
 *
 * Earlier code forwarded only (1). The backend's auth middleware
 * (fixed-backend/src/middleware/auth.middleware.ts) accepts either
 * Bearer OR the cookie, so missing the cookie just means a 401 when
 * the access token is expired — which then surfaces to the user as
 * "Not signed in" on otherwise-valid requests. Forwarding both is
 * the safe, idempotent fix.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL ?? 'http://localhost:3000';

export interface ProxyInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  // If true, the response is expected to be JSON and we return a parsed
  // payload + status. If false, we return the raw Response object.
  json?: boolean;
}

/**
 * Forward a Next.js incoming request to the backend gateway with
 * Authorization + refreshToken cookie preserved. Returns either a
 * NextResponse (json=true) or a fetch Response (json=false).
 *
 * The generic `T` types the parsed JSON body when json=true. For json=false
 * the helper still returns a fetch Response, but the caller usually only
 * cares about status in that case.
 *
 * Usage:
 *   return proxyFetch(req, '/api/business', {
 *     method: 'POST',
 *     body: payload,
 *   });
 */
export async function proxyFetch(
  req: Request,
  path: string,
  init: ProxyInit = {},
): Promise<NextResponse | Response> {
  const { method = 'GET', body, headers: extraHeaders = {}, json = true } = init;

  const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
  if (body != null && !(body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // 1) Forward Authorization if the browser sent it.
  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;

  // 2) Forward the refreshToken cookie if it exists. We pull it from
  //    next/headers on the incoming Next.js request and re-emit it as
  //    a Cookie header on the server-side fetch.
  //    Note: the cookie store is async on newer Next.js versions; the
  //    `await` is safe even on older ones.
  try {
    const jar = await cookies();
    const refresh = jar.get('refreshToken')?.value;
    if (refresh) headers['Cookie'] = `refreshToken=${refresh}`;
  } catch {
    // cookies() throws outside a request context (e.g. unit tests).
    // Best-effort only; the Authorization header is the primary path.
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body:
        body == null
          ? undefined
          : body instanceof FormData
            ? body
            : typeof body === 'string'
              ? body
              : JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!json) return res;

  // For non-2xx, surface the upstream error message verbatim so the
  // page can show "We couldn't sign you in" etc. without losing fidelity.
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const errBody = (data as { error?: string } | null) ?? null;
    return NextResponse.json(
      { error: errBody?.error ?? `Request failed (${res.status})` },
      { status: res.status },
    );
  }
  return NextResponse.json(data ?? {}, { status: res.status });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
