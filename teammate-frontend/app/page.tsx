'use client'

// Single authed-aware landing page.
//
// Guest view: splash with one big "Continue with Google" button. Zero
// marketing fluff. The whole job is to get the user to click that
// button.
//
// Authed view: same URL, re-renders with:
//   - Top nav showing profile chip + sign-out
//   - Hero says "Welcome back, [Name]"
//   - Real sections below pulling from the api helper: businesses,
//     latest readiness report, primary actions (start onboarding,
//     create business, generate report).
//
// The Google OAuth flow (server-side redirect) is the only sign-in path.
// No email/password. No /signin or /signup pages — they're removed and
// any inbound links are redirected to "/".
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  FileText,
  LogOut,
  PieChart,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  consumeSession,
  getAccessToken,
  setAccessToken,
  useAuthSnapshot,
  type SessionProfile,
} from '@/lib/auth-client'
import { api } from '@/lib/api'
import { Avatar } from '@/components/auth/avatar'
import { BrandMark } from '@/components/brand'
import type { Business, Audit } from '@/lib/types'

const FEATURES = [
  {
    icon: BarChart3,
    title: 'AI readiness, scored',
    body: 'Turn websites, docs, and chat history into a clear maturity score with concrete next steps.',
  },
  {
    icon: Bot,
    title: 'Chatbots that know your business',
    body: 'Train on your own materials in minutes. Cite sources. Stay on brand.',
  },
  {
    icon: FileText,
    title: 'Reports worth sharing',
    body: 'AI-drafted audits and proposals with structured sections, evidence, and an export-ready layout.',
  },
  {
    icon: PieChart,
    title: 'Insight, not just analytics',
    body: 'Track engagement, see what is working, and act on it without leaving the dashboard.',
  },
]

export default function Home() {
  const router = useRouter()

  // OAuth callback lands the user here with a `#access_token=…` hash in
  // the URL. Reading that hash during the very first render is fine in
  // a pure CSR app, but Next.js still pre-renders the page on the server
  // for the initial HTML — and the server can't see the hash, so it
  // emits the guest tree. The client then sees the hash and re-renders
  // the authed tree, causing a hydration mismatch.
  //
  // The clean fix: render the GUEST tree on the server AND on the
  // client's first paint, then flip to the authed tree after mount. The
  // user sees a brief flash of the splash, but no React error.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Consume the OAuth hash on the client.
    consumeSession()
    setMounted(true)
  }, [])

  const { accessToken, profile } = useAuthSnapshot()
  // Before mount: always guest (matches SSR). After mount: real auth state.
  const authed = mounted && (!!accessToken || !!getAccessToken())

  const handleLogout = async () => {
    try {
      await api('/api/auth/signout', { method: 'POST' })
    } catch {
      // best effort
    } finally {
      setAccessToken(null, null)
      router.refresh()
    }
  }

  return (
    <main className="relative min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
      {authed ? (
        <Header onLogout={handleLogout} authed={authed} profile={profile} />
      ) : null}
      {authed ? (
        <AuthedHero profile={profile} />
      ) : (
        <GuestSplash />
      )}
      {authed && <AuthedSections />}
      {authed && <Footer authed={authed} />}
    </main>
  )
}

function Header({
  onLogout,
  authed,
  profile,
}: {
  onLogout: () => void
  authed: boolean
  profile: SessionProfile | null
}) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY.current
      if (y > 80 && delta > 6) setHidden(true)
      else if (delta < -2) setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToId = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top, behavior: 'smooth' })
    setHidden(false)
  }
  const scrollTop = (e: React.MouseEvent) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setHidden(false)
  }

  return (
    <header
      className={`sticky top-0 z-40 pt-4 px-4 transition-transform duration-300 ease-out ${
        hidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0'
      }`}
    >
      <div className="relative mx-auto max-w-7xl h-24 rounded-2xl bg-white/65 backdrop-blur-2xl backdrop-saturate-150 border border-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-slate-900/[0.04] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-white/10 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
        />

        <div className="relative h-full px-6 sm:px-8 grid grid-cols-3 items-center">
          {/* Left — logo */}
          <Link
            href="/"
            onClick={scrollTop}
            className="flex items-center gap-3 justify-self-start"
          >
            <BrandMark size={44} priority />
            <span className="text-[16px] font-semibold tracking-tight text-slate-900">
              AIBridge
            </span>
          </Link>

          {/* Center — anchors (slim — only when authed so the splash stays clean) */}
          {authed && (
            <nav className="hidden md:flex items-center justify-self-center">
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100/80 border border-slate-200/80">
                <button type="button" onClick={scrollTop} className="nav-pill">
                  Home
                </button>
                <button type="button" onClick={scrollToId('work')} className="nav-pill">
                  Your work
                </button>
                <button type="button" onClick={scrollToId('features')} className="nav-pill">
                  Features
                </button>
              </div>
            </nav>
          )}

          {/* Right — auth CTA */}
          <div className="flex items-center gap-3 justify-self-end">
            {authed ? (
              <>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-2.5 py-2 rounded-lg transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
                <ProfileChip profile={profile} />
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/api/auth/google/start'
                }}
                className="inline-flex items-center gap-2 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-700 text-white h-11 px-5 rounded-xl text-sm font-medium transition-all shadow-md shadow-indigo-200"
              >
                <GoogleMark />
                Continue with Google
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function ProfileChip({ profile }: { profile: SessionProfile | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Open profile menu"
      >
        <Avatar
          name={profile?.name ?? 'Account'}
          email={profile?.email}
          avatarUrl={profile?.avatarUrl ?? null}
          size={32}
        />
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-slate-800 max-w-[140px] truncate">
            {profile?.name ?? 'Account'}
          </span>
          <span className="text-[11px] text-slate-500 max-w-[140px] truncate">
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
          <a
            href="#work"
            onClick={(e) => {
              e.preventDefault()
              setOpen(false)
              const el = document.getElementById('work')
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY - 96
                window.scrollTo({ top, behavior: 'smooth' })
              }
            }}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Your work
          </a>
        </div>
      )}
    </div>
  )
}

function GuestSplash() {
  return (
    <section id="hero" className="relative scroll-mt-32">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle_at_center,rgba(79,70,229,0.10)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(circle_at_center,black_30%,transparent_70%)]"
      />
      <div className="relative mx-auto max-w-3xl px-6 flex flex-col items-center justify-center min-h-[100dvh] text-center">
        <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05]">
          Sign in to{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            AIBridge
          </span>
        </h1>
        <p className="mt-6 text-lg text-slate-600 leading-relaxed">
          Assess AI readiness, deploy custom chat agents, and generate actionable insights in seconds.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/api/auth/google/start'
            }}
            className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-900 h-14 px-7 rounded-2xl text-[15px] font-medium border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            <GoogleMark />
            Continue with Google
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Secure, one-click sign in. We only use your email to create your workspace.
          </p>
        </div>
      </div>
    </section>
  )
}

function AuthedHero({ profile }: { profile: SessionProfile | null }) {
  const firstName =
    profile?.name?.split(' ')[0]?.trim() ||
    profile?.email?.split('@')[0] ||
    'there'
  return (
    <section id="hero" className="relative scroll-mt-32">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle_at_center,rgba(79,70,229,0.10)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(circle_at_center,black_30%,transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-24 md:pb-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Signed in
            </div>
            <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05]">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              Your businesses, knowledge bases, chatbots, and reports are all
              below. Pick up where you left off.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#work"
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById('work')
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 96
                  window.scrollTo({ top, behavior: 'smooth' })
                }
              }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-6 rounded-xl text-[15px] font-medium transition-colors"
            >
              Jump to your work
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function AuthedSections() {
  return (
    <>
      <WorkSection />
    </>
  )
}

function WorkSection() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [latest, setLatest] = useState<Record<string, Audit | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ businesses: Business[] }>('/api/business/mine')
        if (cancelled) return
        const list = data.businesses ?? []
        setBusinesses(list)
        const audits: Record<string, Audit | null> = {}
        await Promise.all(
          list.map(async (b) => {
            try {
              const r = await api<{ audit: Audit | null }>(
                `/api/audit/business/${b.id}/latest`,
              )
              audits[b.id] = r.audit
            } catch {
              audits[b.id] = null
            }
          }),
        )
        if (!cancelled) setLatest(audits)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const kpiReadiness = Object.values(latest).find((a) => a != null)
    ? `${Object.values(latest).find((a) => a != null)!.readinessScore}/100`
    : '—'

  return (
    <section id="work" className="border-t border-slate-200 bg-slate-50/50 scroll-mt-32">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-indigo-600 font-semibold">
              Your work
            </div>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
              Where you left off
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Open full dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <KpiCard
            label="Businesses"
            value={loading ? '—' : String(businesses.length)}
            icon={<Building2 className="w-5 h-5" />}
          />
          <KpiCard
            label="Latest readiness"
            value={loading ? '—' : kpiReadiness}
            icon={<Sparkles className="w-5 h-5" />}
          />
          <KpiCard
            label="AI workflows"
            value={loading ? '—' : 'Onboarding, Chat, Reports'}
            icon={<Rocket className="w-5 h-5" />}
            hint="All in one workspace"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <ActionCard
            href={
              businesses[0]
                ? `/dashboard/onboarding?businessId=${businesses[0].id}`
                : '/dashboard/onboarding'
            }
            title="Set up your chatbot"
            body="Drop a URL, add documents, train, chat. Four quick steps."
            cta={businesses[0] ? 'Continue setup' : 'Start setup'}
            icon={<Rocket className="w-6 h-6" />}
            accent
          />
          <ActionCard
            href="/dashboard/businesses/new"
            title="Create a business"
            body="Spin up a new business profile in under a minute."
            cta="Get started"
            icon={<Plus className="w-6 h-6" />}
          />
          <ActionCard
            href={
              businesses[0]
                ? `/dashboard/reports/new?businessId=${businesses[0].id}`
                : '/dashboard/businesses/new'
            }
            title="AI readiness report"
            body="Generate a structured audit from your materials."
            cta="Generate report"
            icon={<FileText className="w-6 h-6" />}
            disabled={!businesses.length}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-slate-900">Your businesses</h3>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : businesses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-600">
                No businesses yet. Create your first one to get started.
              </p>
              <Link
                href="/dashboard/businesses/new"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Create a business
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {businesses.map((b) => {
                const audit = latest[b.id]
                return (
                  <li
                    key={b.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/businesses/${b.id}`}
                        className="font-medium text-slate-900 hover:underline truncate block"
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-slate-500 truncate">
                        {b.industry}
                        {audit ? ` · readiness ${audit.readinessScore}/100` : ''}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/businesses/${b.id}`}
                      className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
                    >
                      Open
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="p-2 bg-indigo-50 rounded-md text-indigo-600">{icon}</div>
      </div>
      <p className="text-2xl font-semibold mt-3 text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function ActionCard({
  href,
  title,
  body,
  cta,
  icon,
  accent,
  disabled,
}: {
  href: string
  title: string
  body: string
  cta: string
  icon: React.ReactNode
  accent?: boolean
  disabled?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-6 transition-all ${
        accent
          ? 'bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-indigo-100'
          : 'bg-white border-slate-200 hover:border-indigo-200'
      } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600 mt-1">{body}</p>
        </div>
        <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
          {icon}
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        {cta}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="border-t border-slate-200 bg-white scroll-mt-32">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.18em] text-indigo-600 font-semibold">
            What&apos;s inside
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            One workspace. Every AI workflow.
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            Stop stitching tools together. AIBridge ships with everything a
            consulting team needs to assess, deploy, and measure AI for their
            clients.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group rounded-2xl bg-slate-50 border border-slate-200 p-6 hover:border-indigo-200 hover:bg-white hover:shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-50 grid place-items-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {f.body}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Trust() {
  return (
    <section id="trust" className="border-t border-slate-200 scroll-mt-32">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24 grid md:grid-cols-3 gap-10">
        <div className="md:col-span-2">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
            From raw website to ready-to-share audit — in minutes.
          </h2>
          <p className="mt-3 text-slate-600 leading-relaxed max-w-2xl">
            Drop in a business, paste a URL, upload the PDFs. AIBridge crawls,
            chunks, embeds, and structures your materials, then drafts the
            report. You stay in control of the wording.
          </p>
          <ol className="mt-8 space-y-4 max-w-xl">
            {[
              'Sign in with Google — one click.',
              'Add your business and paste a website URL.',
              'Crawl, index, and chat with your materials.',
              'Generate a readiness audit, refine, share.',
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-semibold grid place-items-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-slate-700 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 self-start">
          <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            Trust
          </div>
          <p className="mt-4 text-sm text-slate-700 leading-relaxed">
            Your data stays on the cloud infrastructure you already trust.
            Authenticated sessions, encrypted tokens, and per-business
            isolation baked in.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-slate-600">
            <li>• Google sign-in only</li>
            <li>• Bearer-token access in storage only</li>
            <li>• Per-business knowledge isolation</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function Footer({ authed }: { authed: boolean }) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between text-sm text-slate-500">
        <div className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="font-medium text-slate-700">AIBridge</span>
          <span className="hidden sm:inline ml-2 text-slate-400">·</span>
          <span className="hidden sm:inline">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}

function GoogleMark() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  )
}
