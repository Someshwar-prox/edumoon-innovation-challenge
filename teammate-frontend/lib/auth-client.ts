'use client'

// Single source of truth for the in-memory access token + refresh cookie
// session. Used by:
//   - Google OAuth server-side redirect (lands at /dashboard#access_token=…&user_id=…)
//   - Email/password signup + signin (Next.js route hands us back the JWT,
//     we stash it here, then navigate to /dashboard)
//   - The dashboard layout, which calls consumeSession() on mount
//
// Storage strategy: token + profile live in BOTH a module-level variable
// (so fetch wrappers can pick it up synchronously) AND localStorage
// (so a hard refresh rehydrates without bouncing the user back to /signin).
// The refresh token lives in an HTTP-only cookie set by the backend; the
// browser never sees it.
import { useEffect, useState } from 'react'

const ACCESS_KEY = 'aibridge.access_token'
const USER_ID_KEY = 'aibridge.user_id'
const NAME_KEY = 'aibridge.user_name'
const EMAIL_KEY = 'aibridge.user_email'
const AVATAR_KEY = 'aibridge.user_avatar'

export interface SessionProfile {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

let accessToken: string | null = null
let userId: string | null = null
let profile: SessionProfile | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function setAccessToken(token: string | null, uid: string | null, profileData?: Partial<SessionProfile> | null) {
  accessToken = token
  userId = uid
  const s = storage()
  if (token && uid) {
    // Reuse existing profile fields if the caller only passed token+id
    const next: SessionProfile = {
      id: uid,
      name: profileData?.name ?? profile?.name ?? 'User',
      email: profileData?.email ?? profile?.email ?? '',
      avatarUrl:
        profileData?.avatarUrl !== undefined
          ? profileData.avatarUrl
          : profile?.avatarUrl ?? null,
    }
    profile = next
    if (s) {
      s.setItem(ACCESS_KEY, token)
      s.setItem(USER_ID_KEY, uid)
      s.setItem(NAME_KEY, next.name)
      s.setItem(EMAIL_KEY, next.email)
      if (next.avatarUrl) {
        s.setItem(AVATAR_KEY, next.avatarUrl)
      } else {
        s.removeItem(AVATAR_KEY)
      }
    }
  } else {
    profile = null
    if (s) {
      s.removeItem(ACCESS_KEY)
      s.removeItem(USER_ID_KEY)
      s.removeItem(NAME_KEY)
      s.removeItem(EMAIL_KEY)
      s.removeItem(AVATAR_KEY)
    }
  }
  emit()
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken
  // Rehydrate lazily so the dashboard layout's first check finds it
  // after a hard reload (module-level vars reset to null on reload).
  const s = storage()
  if (s) {
    const t = s.getItem(ACCESS_KEY)
    if (t) accessToken = t
  }
  return accessToken
}

export function getCurrentUserId(): string | null {
  if (userId) return userId
  const s = storage()
  if (s) {
    const u = s.getItem(USER_ID_KEY)
    if (u) userId = u
  }
  return userId
}

export function getProfile(): SessionProfile | null {
  if (profile) return profile
  const s = storage()
  if (s) {
    const u = s.getItem(USER_ID_KEY)
    if (u) {
      profile = {
        id: u,
        name: s.getItem(NAME_KEY) || 'User',
        email: s.getItem(EMAIL_KEY) || '',
        avatarUrl: s.getItem(AVATAR_KEY) || null,
      }
    }
  }
  return profile
}

// Pick up an access token from EITHER the URL hash (Google OAuth callback)
// or localStorage (already-authed hard refresh).
export function consumeSession(): boolean {
  if (typeof window === 'undefined') return false

  // 1) URL hash takes priority — fresh Google callback.
  const rawHash = window.location.hash.replace(/^#/, '')
  if (rawHash) {
    const params = new URLSearchParams(rawHash)
    const token = params.get('access_token')
    const uid = params.get('user_id')
    if (token && uid) {
      // Name/email/avatar may be passed too — Google flow includes them.
      setAccessToken(token, uid, {
        id: uid,
        name: params.get('name') ?? undefined,
        email: params.get('email') ?? undefined,
        avatarUrl: params.get('avatar') || null,
      })
      history.replaceState(null, '', window.location.pathname + window.location.search)
      return true
    }
  }

  // 2) Otherwise rehydrate from localStorage (already-logged-in reload).
  if (!accessToken) {
    const s = storage()
    if (s) {
      const t = s.getItem(ACCESS_KEY)
      const u = s.getItem(USER_ID_KEY)
      if (t && u) {
        accessToken = t
        userId = u
        profile = {
          id: u,
          name: s.getItem(NAME_KEY) || 'User',
          email: s.getItem(EMAIL_KEY) || '',
          avatarUrl: s.getItem(AVATAR_KEY) || null,
        }
        emit()
        return true
      }
    }
  }
  return false
}

// Legacy alias — keep so other modules still compile.
export const consumeOAuthHash = consumeSession

export function useAuthSnapshot() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((t) => t + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return { accessToken, userId, profile, tick }
}

// Wrap fetch so the access token rides along automatically and 401s clear
// the session.
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {})
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const res = await fetch(input, { ...init, headers, credentials: 'include' })
  if (res.status === 401) {
    setAccessToken(null, null)
  }
  return res
}
