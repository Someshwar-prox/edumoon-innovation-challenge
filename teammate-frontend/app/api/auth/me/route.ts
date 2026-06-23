import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'

export async function GET() {
  // Forward the refresh cookie that the browser sent to us along to the
  // backend so /api/auth/me can authenticate the session.
  const jar = await cookies()
  const refresh = jar.get('refreshToken')?.value
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (refresh) headers['Cookie'] = `refreshToken=${refresh}`
    const me = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers,
      cache: 'no-store',
    })
    const text = await me.text()
    return new NextResponse(text, {
      status: me.status,
      headers: { 'content-type': me.headers.get('content-type') ?? 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
