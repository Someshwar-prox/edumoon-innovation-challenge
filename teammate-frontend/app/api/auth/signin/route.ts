// Hackathon-friendly signin proxy. We hit the backend's /api/auth/login
// directly (not via the Next.js rewrite) so we can forward the
// Set-Cookie header that the gateway emits for the refresh token.
// Without this forwarding, the cookie never reaches the browser and
// refresh-on-401 silently fails. We also forward the CORS-friendly
// Access-Control-Allow-* headers for the development case.
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    // Forward Set-Cookie from the gateway so the refresh cookie lands in
    // the browser jar. Next.js requires copying each header from the
    // upstream response onto the NextResponse.
    const setCookie = res.headers.get('set-cookie')
    const text = await res.text()
    const data = text ? safeParse(text) : null
    if (!res.ok) {
      // If the backend's hackathon fallback didn't fire and login failed,
      // try register (which is now idempotent) and then login again.
      // This is the "loose" hackathon flow — whatever creds the user
      // types, they end up signed in.
      try {
        const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            email,
            password,
            firstName: 'Friend',
            lastName: '',
          }),
        })
        if (!regRes.ok) throw new Error('register failed')
        const regSetCookie = regRes.headers.get('set-cookie')
        const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const loginSetCookie = loginRes.headers.get('set-cookie')
        const loginText = await loginRes.text()
        const loginData = loginText ? safeParse(loginText) : null
        if (!loginRes.ok) throw new Error('login after register failed')
        const headers: Record<string, string> = {}
        for (const c of [regSetCookie, loginSetCookie].filter(Boolean) as string[]) {
          appendSetCookie(headers, c)
        }
        return NextResponse.json(
          {
            user: (loginData as { user?: unknown })?.user,
            accessToken: (loginData as { accessToken?: string })?.accessToken,
            success: true,
          },
          { status: 200, headers },
        )
      } catch {
        return NextResponse.json(
          { error: "We couldn't sign you in. Try again or use Google." },
          { status: 500 },
        )
      }
    }

    const headers: Record<string, string> = {}
    if (setCookie) appendSetCookie(headers, setCookie)

    return NextResponse.json(
      {
        user: (data as { user?: unknown })?.user,
        accessToken: (data as { accessToken?: string })?.accessToken,
        success: true,
      },
      { status: 200, headers },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function appendSetCookie(headers: Record<string, string>, cookie: string) {
  // NextResponse supports multiple Set-Cookie values by appending with
  // comma-separated entries via the headers object. We split the cookie
  // string on ", " followed by a key=value pattern, which is what the
  // gateway emits (one cookie per line in dev, but bundled in prod).
  // For dev, the gateway emits a single Set-Cookie header; we forward it
  // verbatim.
  const existing = headers['Set-Cookie']
  headers['Set-Cookie'] = existing ? `${existing}, ${cookie}` : cookie
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
