'use client'

import { use, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Download } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Audit } from '@/lib/types'

interface ReportDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id: reportId } = use(params)
  const [audit, setAudit] = useState<Audit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ audit: Audit }>(`/api/audit/${reportId}`)
        if (!cancelled) setAudit(data.audit)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load report')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reportId])

  const scores = (audit?.estimatedBenefits?.subscores as Record<string, number> | undefined) ?? {}

  return (
    <div className="p-8">
      <div className="max-w-5xl">
        <Link href="/dashboard">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </Link>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading report…
          </div>
        ) : error || !audit ? (
          <div className="p-6 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error ?? 'Report not found'}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold">AI readiness report</h2>
                <p className="text-muted-foreground mt-2">
                  Generated on {new Date(audit.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => window.print()}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <div className="bg-card rounded-lg border border-border p-8 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Overall AI readiness</p>
                  <h3 className={`text-5xl font-bold ${getScoreColor(audit.readinessScore)}`}>
                    {audit.readinessScore}/100
                  </h3>
                </div>
                {Object.keys(scores).length > 0 && (
                  <div className="text-right">
                    <p className="text-muted-foreground text-sm mb-2">Category breakdown</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {Object.entries(scores).map(([k, v]) => (
                        <div key={k}>
                          <p className="text-xs text-muted-foreground">{labelize(k)}</p>
                          <p className={`text-base font-semibold ${getScoreColor(v)}`}>
                            {v}/100
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {audit.businessSummary && (
                <p className="mt-6 text-sm text-muted-foreground whitespace-pre-wrap">
                  {audit.businessSummary}
                </p>
              )}
            </div>

            <Section title="Strengths" items={(audit.strengths as string[]) ?? []} tone="good" />
            <Section title="Weaknesses" items={(audit.weaknesses as string[]) ?? []} tone="bad" />
            <Section title="Opportunities" items={(audit.aiOpportunities as string[]) ?? []} tone="neutral" />

            {Array.isArray(audit.automationSuggestions) && audit.automationSuggestions.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6 mt-6">
                <h3 className="text-xl font-semibold mb-4">Automation suggestions</h3>
                <ul className="space-y-3">
                  {audit.automationSuggestions.map((s, i) => {
                    const item = s as { title?: string; description?: string; estimatedHoursSavedPerWeek?: number | null }
                    return (
                      <li key={i} className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold">{item.title ?? 'Automation idea'}</h4>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                        {item.estimatedHoursSavedPerWeek != null && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Estimated {item.estimatedHoursSavedPerWeek}h saved per week
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'good' | 'bad' | 'neutral'
}) {
  if (items.length === 0) return null
  const accent = tone === 'good' ? 'border-green-500' : tone === 'bad' ? 'border-orange-500' : 'border-primary'
  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      <ul className="space-y-2">
        {items.map((line, i) => (
          <li
            key={i}
            className={`border-l-4 ${accent} pl-4 py-2 text-sm text-foreground`}
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-500'
  if (score >= 40) return 'text-yellow-500'
  return 'text-orange-500'
}

function labelize(k: string) {
  return k
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
