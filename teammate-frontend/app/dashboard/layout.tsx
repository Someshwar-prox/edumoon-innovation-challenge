'use client'

// Premium dashboard shell.
// Left sidebar (240px, collapsible to icons), top bar with user menu,
// main content fills the rest. All routes already wired in
// teammate-frontend/app/dashboard/*.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  consumeSession,
  getAccessToken,
  setAccessToken,
  useAuthSnapshot,
} from '@/lib/auth-client'
import { api, refreshAccessToken } from '@/lib/api'
import { Avatar } from '@/components/auth/avatar'
import { BrandMark } from '@/components/brand'
import {
  BarChart3,
  Building2,
  Bot,
  FileText,
  PieChart,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  // exact: only highlight when path matches exactly (for the overview item)
  exact?: boolean
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: BarChart3, exact: true },
  { href: '/dashboard/businesses', label: 'Businesses', icon: Building2 },
  { href: '/dashboard/chatbots', label: 'Chatbots', icon: Bot },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/analytics', label: 'Analytics', icon: PieChart },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  // SSR/CSR split: the server can't see localStorage, so the very
  // first render must always be the "loading" tree — otherwise React
  // will try to hydrate a tree that doesn't match the server HTML and
  // throw a hydration mismatch. After mount, we re-evaluate against
  // localStorage and either flip to the authed tree or fall through
  // to the refresh-cookie round-trip.
  const [authed, setAuthed] = useState<boolean>(false)
  const [bootError, setBootError] = useState<string | null>(null)

  // Runs on the client only (useEffect doesn't fire during SSR).
  // 1. Synchronously rehydrate the access token from localStorage.
  // 2. If we got one, flip to the authed tree — no spinner needed.
  // 3. If not, try the refresh-cookie round-trip. Only when both fail
  //    do we route to "/" (the home splash now has the Google CTA).
  useEffect(() => {
    let cancelled = false
    try {
      consumeSession()
    } catch (err) {
      if (!cancelled) {
        setBootError(
          err instanceof Error ? err.message : 'Session bootstrap failed',
        )
      }
    }
    if (cancelled) return
    if (getAccessToken()) {
      setAuthed(true)
      return
    }
    ;(async () => {
      const refreshed = await refreshAccessToken()
      if (cancelled) return
      if (refreshed) {
        setAuthed(true)
      } else {
        router.replace('/')
      }
    })().catch((err) => {
      if (!cancelled) {
        setBootError(
          err instanceof Error ? err.message : 'Session bootstrap failed',
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [router])

  const handleLogout = async () => {
    try {
      await api('/api/auth/signout', { method: 'POST' })
    } catch {
      // best effort
    } finally {
      setAccessToken(null, null)
      router.push('/')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="text-center space-y-3">
          <div className="text-sm text-slate-500">
            {bootError
              ? `Auth error: ${bootError}`
              : 'Restoring your session…'}
          </div>
          {bootError && (
            <button
              type="button"
              onClick={() => router.replace('/')}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Go to home
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col bg-white border-r border-slate-200 transition-[width] duration-200 ${
          collapsed ? 'w-17' : 'w-60'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <BrandMark size={32} priority />
            {!collapsed && (
              <span className="text-base font-semibold tracking-tight text-slate-900 truncate">
                AIBridge
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 shrink-0 ${
                    active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-2 border-t border-slate-200">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className={`w-full ${
              collapsed ? 'justify-center px-0' : 'justify-start'
            } text-slate-600 hover:text-slate-900 hover:bg-slate-100`}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Log out</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <span className="font-semibold">AIBridge</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 text-slate-500"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden p-1.5 rounded hover:bg-slate-100"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Workspace
              </div>
              <div className="text-sm font-medium text-slate-900">
                {pathname === '/dashboard'
                  ? 'Overview'
                  : (NAV.find((n) =>
                      n.exact ? pathname === n.href : pathname.startsWith(n.href)
                    )?.label ?? 'Dashboard')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserChip />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function UserChip() {
  const [open, setOpen] = useState(false)
  const { profile } = useAuthSnapshot()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Avatar
          name={profile?.name ?? 'Account'}
          email={profile?.email}
          avatarUrl={profile?.avatarUrl ?? null}
          size={28}
        />
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-slate-800 max-w-35 truncate">
            {profile?.name ?? 'Account'}
          </span>
          <span className="text-[11px] text-slate-500 max-w-35 truncate">
            {profile?.email ?? ''}
          </span>
        </div>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-30"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-sm font-medium text-slate-800 truncate">
              {profile?.name ?? 'Account'}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {profile?.email ?? ''}
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <Link
            href="/dashboard"
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Dashboard
          </Link>
        </div>
      )}
    </div>
  )
}
