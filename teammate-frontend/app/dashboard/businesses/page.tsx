'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { Business } from '@/lib/types'

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ business?: Business; businesses?: Business[] }>('/api/businesses')
        if (!cancelled) {
          setBusinesses(data.businesses ?? (data.business ? [data.business] : []))
        }
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

  return (
    <div className="p-8">
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Businesses</h2>
            <p className="text-muted-foreground mt-2">Manage your business profiles</p>
          </div>
          <Link href="/dashboard/businesses/new">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              New business
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-card rounded-lg border border-border">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading businesses…
            </div>
          ) : businesses.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No businesses yet</p>
              <Link href="/dashboard/businesses/new">
                <Button className="bg-primary hover:bg-primary/90">
                  Create your first business
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {businesses.map((b) => (
                <li key={b.id} className="p-5 flex items-center justify-between">
                  <div>
                    <Link
                      href={`/dashboard/businesses/${b.id}`}
                      className="font-medium hover:underline"
                    >
                      {b.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {b.industry}
                      {b.websiteUrl ? ` · ${b.websiteUrl}` : ''}
                    </p>
                  </div>
                  <Link href={`/dashboard/businesses/${b.id}`}>
                    <Button variant="outline" size="sm">
                      Open
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
