// Signup proxy that forwards the gateway's Set-Cookie header so the
// refresh token lands in the browser jar. Mirrors the signin proxy.
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const firstName =
      typeof body?.firstName === 'string' && body.firstName.trim()
        ? body.firstName.trim()
        : 'Friend'
    const lastName =
      typeof body?.lastName === 'string' && body.lastName.trim()
        ? body.lastName.trim()
        : ''

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName }),
    })
    const regSetCookie = regRes.headers.get('set-cookie')
    const regText = await regRes.text()
    if (!regRes.ok) {
      return NextResponse.json(
        { error: `Registration failed (${regRes.status})` },
        { status: regRes.status },
      )
    }

    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const loginSetCookie = loginRes.headers.get('set-cookie')
    const loginText = await loginRes.text()
    const loginData = loginText ? safeParse(loginText) : null
    if (!loginRes.ok) {
      return NextResponse.json(
        { error: `Login failed (${loginRes.status})` },
        { status: loginRes.status },
      )
    }

    const headers: Record<string, string> = {}
    for (const c of [regSetCookie, loginSetCookie].filter(Boolean) as string[]) {
      const existing = headers['Set-Cookie']
      headers['Set-Cookie'] = existing ? `${existing}, ${c}` : c
    }

    return NextResponse.json(
      {
        user: (loginData as { user?: unknown })?.user,
        accessToken: (loginData as { accessToken?: string })?.accessToken,
        success: true,
      },
      { status: 200, headers },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text;
  }
}
