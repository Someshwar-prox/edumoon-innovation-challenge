'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Business, Audit } from '@/lib/types'

function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preset = searchParams.get('businessId') ?? ''

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [businessId, setBusinessId] = useState(preset)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingBusinesses, setLoadingBusinesses] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ business?: Business; businesses?: Business[] }>('/api/businesses')
        if (cancelled) return
        
        const loadedBusinesses = data.businesses ?? (data.business ? [data.business] : [])
        setBusinesses(loadedBusinesses)
        
        if (!businessId && loadedBusinesses.length > 0) {
          setBusinessId(loadedBusinesses[0].id)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load businesses')
        }
      } finally {
        if (!cancelled) setLoadingBusinesses(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  const handleGenerate = async () => {
    if (!businessId) {
      setError('Please select a business')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await api<{ audit: Audit }>(`/api/audit/generate/${businessId}`, {
        method: 'POST',
        body: { includeDocuments: true, language: 'en' },
      })
      router.push(`/dashboard/reports/${data.audit.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <Link href="/dashboard">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </Link>

        <div className="mb-8">
          <h2 className="text-3xl font-bold">Generate AI readiness report</h2>
          <p className="text-muted-foreground mt-2">
            Runs the ai-service against your crawled pages and uploaded documents.
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-8">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium block mb-2">Business</label>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                disabled={isLoading || loadingBusinesses}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {loadingBusinesses ? (
                  <option value="">Loading…</option>
                ) : businesses.length === 0 ? (
                  <option value="">No businesses — create one first</option>
                ) : (
                  <>
                    <option value="">Select a business…</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleGenerate}
                disabled={isLoading || !businessId}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating…
                  </>
                ) : (
                  'Generate report'
                )}
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" className="border-border hover:bg-secondary/10">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-muted-foreground">Loading…</div>
      }
    >
      <NewReportForm />
    </Suspense>
  )
}
