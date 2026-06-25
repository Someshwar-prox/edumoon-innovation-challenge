'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Plus, ArrowRight, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import type { Business, Audit } from '@/lib/types'

export default function ReportsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch businesses
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

  // Fetch audits for selected business
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await api<{ audits: Audit[] }>(`/api/audit/business/${selectedId}`)
        if (cancelled) return
        // Sort newest first
        const sorted = (data.audits ?? []).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setAudits(sorted)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reports')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateStr))
  }

  const getScoreColor = (score?: number | null) => {
    if (score == null) return 'text-slate-400'
    if (score >= 80) return 'text-emerald-500'
    if (score >= 50) return 'text-amber-500'
    return 'text-rose-500'
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Readiness Reports</h2>
            <p className="text-muted-foreground mt-2">
              View and manage AI readiness audits for your business
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {businesses.length > 0 && (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            
            {selectedId && (
              <Link
                href={`/dashboard/reports/new?businessId=${selectedId}`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Generate Report
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200 flex gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-4">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            <p>Loading reports...</p>
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No reports generated</h3>
            <p className="text-slate-500 mb-6">You haven't generated any AI readiness reports for this business yet.</p>
            {selectedId && (
              <Link
                href={`/dashboard/reports/new?businessId=${selectedId}`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Generate First Report
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {audits.map((audit) => {
              const business = businesses.find(b => b.id === audit.businessId)
              const scoreColor = getScoreColor(audit.readinessScore)
              
              return (
                <div key={audit.id} className="group relative rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all flex flex-col h-full overflow-hidden">
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      {audit.readinessScore !== null && (
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${scoreColor}`}>
                            {audit.readinessScore}%
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                            Score
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-lg text-slate-900 line-clamp-1 mb-1">
                      {business?.websiteUrl ? new URL(business.websiteUrl).hostname : 'System Audit'}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(audit.createdAt)}
                    </div>
                    
                    <div className="mt-auto">
                      <Link 
                        href={`/dashboard/reports/${audit.id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 group-hover:underline"
                      >
                        View full report
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                  {/* Progress bar accent */}
                  <div className="h-1 w-full bg-slate-100">
                    <div 
                      className="h-full bg-emerald-500" 
                      style={{ width: audit.readinessScore ? `${audit.readinessScore}%` : '100%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
