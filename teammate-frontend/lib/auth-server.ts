const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'

interface SignInInput {
  email: string
  password: string
}

export async function doSignIn(input: SignInInput) {
  // Hit the Next.js rewrite proxy (relative URL) so the browser treats the
  // request as same-origin and forwards/receives HttpOnly cookies
  // correctly. The Next.js dev server proxies /api/* → BACKEND_URL.
  const res = await fetch(`/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(data?.error ?? `Login failed (${res.status})`)
  }
  return data as {
    user: { id: string; email: string; firstName?: string; lastName?: string; role: string }
    accessToken: string
  }
}

export async function doSignUp(input: SignInInput & { firstName: string; lastName: string }) {
  const regRes = await fetch(`/api/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  if (!regRes.ok) {
    const text = await regRes.text()
    const data = text ? JSON.parse(text) : null
    throw new Error(data?.error ?? `Registration failed (${regRes.status})`)
  }
  return doSignIn({ email: input.email, password: input.password })
}
