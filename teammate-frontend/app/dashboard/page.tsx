'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Plus,
  ArrowRight,
  FileText,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Rocket,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Business, Audit } from '@/lib/types'

interface BusinessWithExtras {
  business: Business
  latestAudit: Audit | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [latest, setLatest] = useState<Record<string, Audit | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ business?: Business; businesses?: Business[] }>('/api/businesses')
        if (cancelled) return
        
        const loadedBusinesses = data.businesses ?? (data.business ? [data.business] : [])
        setBusinesses(loadedBusinesses)
        
        const audits: Record<string, Audit | null> = {}
        await Promise.all(
          loadedBusinesses.map(async (b) => {
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
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-8">
      <div className="max-w-6xl">
        <div className="mb-12 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back</h2>
            <p className="text-muted-foreground">
              Manage your businesses, analyze AI readiness, and power your chatbot.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.refresh()}
            className="border-border"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* KPI strip */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <KpiCard
            label="Businesses"
            value={loading ? '—' : String(businesses.length)}
            icon={<Sparkles className="w-5 h-5" />}
          />
          <KpiCard
            label="Latest readiness"
            value={
              loading
                ? '—'
                : Object.values(latest).find((a) => a != null)
                  ? `${Object.values(latest).find((a) => a != null)!.readinessScore}/100`
                  : 'Not generated'
            }
            icon={<FileText className="w-5 h-5" />}
          />
          <KpiCard
            label="Widgets"
            value="—"
            hint="Open a business to manage its chat widget"
            icon={<MessageSquare className="w-5 h-5" />}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* New: Set up your chatbot (the 4-step on-boarding flow) */}
          <div className="md:col-span-3 bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-2xl border border-indigo-100 p-6 md:p-7">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white shrink-0">
                  <Rocket className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">
                    Set up your chatbot
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 max-w-xl">
                    Four quick steps: drop a URL, optionally add documents, watch the
                    training, then chat in text or voice.
                  </p>
                </div>
              </div>
              <Link
                href={
                  businesses[0]
                    ? `/dashboard/onboarding?businessId=${businesses[0].id}`
                    : '/dashboard/onboarding'
                }
              >
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-5">
                  Start setup
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Create business</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up a new business profile
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Plus className="w-6 h-6 text-primary" />
              </div>
            </div>
            <Link href="/dashboard/businesses/new">
              <Button className="w-full bg-primary hover:bg-primary/90">
                Get started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">AI readiness report</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate one against the active business
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Plus className="w-6 h-6 text-primary" />
              </div>
            </div>
            <Link
              href={
                businesses[0]
                  ? `/dashboard/reports/new?businessId=${businesses[0].id}`
                  : '/dashboard/businesses/new'
              }
            >
              <Button
                disabled={!businesses.length}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Generate report
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Create chatbot</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Deploy a chat widget for your site
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Plus className="w-6 h-6 text-primary" />
              </div>
            </div>
            <Link
              href={
                businesses[0]
                  ? `/dashboard/chatbots/new?businessId=${businesses[0].id}`
                  : '/dashboard/businesses/new'
              }
            >
              <Button
                disabled={!businesses.length}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Create chatbot
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold text-lg mb-4">Your businesses</h3>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : businesses.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No businesses yet. Create your first one to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {businesses.map((b) => {
                const audit = latest[b.id]
                const entry: BusinessWithExtras = { business: b, latestAudit: audit }
                return (
                  <li key={b.id} className="py-3 flex items-center justify-between">
                    <div>
                      <Link
                        href={`/dashboard/businesses/${b.id}`}
                        className="font-medium hover:underline"
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {b.industry}
                        {audit ? ` · readiness ${audit.readinessScore}/100` : ''}
                      </p>
                    </div>
                    <Link href={`/dashboard/businesses/${b.id}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
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
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{label}</p>
        <div className="p-2 bg-primary/10 rounded-md text-primary">{icon}</div>
      </div>
      <p className="text-2xl font-semibold mt-3">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}
