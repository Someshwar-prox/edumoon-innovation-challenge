'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartLegend, ChartTooltipContent } from '@/components/ui/chart'
import { TrendingUp, MessageSquare, FileText, Sparkles, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { Business, ChatSession } from '@/lib/types'

interface AnalyticRow {
  id: string;
  metricType: string;
  metricValue: number;
  date: string;
}

export default function AnalyticsDashboardPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [rows, setRows] = useState<AnalyticRow[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ businesses: Business[] }>('/api/business/mine')
        if (cancelled) return
        setBusinesses(data.businesses ?? [])
        if (data.businesses?.[0]?.id) setSelectedId(data.businesses[0].id)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load businesses')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    ;(async () => {
      try {
        const [a, s] = await Promise.all([
          api<{ analytics: AnalyticRow[] }>(`/api/analytics/${selectedId}?limit=200`),
          api<{ chatSessions: ChatSession[] }>(`/api/chat/business`).catch(() => null),
        ])
        if (cancelled) return
        setRows(a.analytics ?? [])
        setSessions(s?.chatSessions ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const totalChats = sessions.length
  const activeChats = sessions.filter((s) => !s.endedAt).length
  const satisfaction =
    sessions
      .map((s) => s.satisfactionScore)
      .filter((n): n is number => typeof n === 'number')
      .reduce((acc, n, _, arr) => acc + n / arr.length, 0) || 0

  const metricsByType: Record<string, number> = {}
  for (const r of rows) {
    metricsByType[r.metricType] =
      (metricsByType[r.metricType] ?? 0) + Number(r.metricValue ?? 0)
  }
  const chartData = Object.entries(metricsByType).map(([name, value]) => ({
    name: labelize(name),
    value,
  }))
  const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

  return (
    <div className="p-8">
      <div className="max-w-7xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Analytics</h2>
            <p className="text-muted-foreground mt-2">
              Track chatbot usage and readiness activity per business
            </p>
          </div>
          {businesses.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : businesses.length === 0 ? (
          <div className="p-12 text-center bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">
              Create a business first to see analytics here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <Kpi label="Total chats" value={String(totalChats)} icon={<MessageSquare className="w-6 h-6" />} />
              <Kpi label="Active chats" value={String(activeChats)} icon={<TrendingUp className="w-6 h-6" />} />
              <Kpi label="Satisfaction" value={satisfaction ? `${satisfaction.toFixed(1)}/5` : '—'} icon={<Sparkles className="w-6 h-6" />} />
              <Kpi label="Events recorded" value={String(rows.length)} icon={<FileText className="w-6 h-6" />} />
            </div>

            {chartData.length > 0 && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">Metrics by type</h3>
                  <div className="h-80 w-full">
                    <ChartContainer
                      config={Object.fromEntries(
                        chartData.map((d, i) => [d.name, { label: d.name, color: PIE_COLORS[i % PIE_COLORS.length] }]),
                      )}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis stroke="var(--color-muted-foreground)" dataKey="name" />
                          <YAxis stroke="var(--color-muted-foreground)" />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend />
                          <Bar dataKey="value" fill="var(--color-primary)" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">Distribution</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={120}
                          dataKey="value"
                        >
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm mb-2">{label}</p>
          <h3 className="text-3xl font-bold">{value}</h3>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg text-primary">{icon}</div>
      </div>
    </div>
  )
}

function labelize(k: string) {
  return k
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
