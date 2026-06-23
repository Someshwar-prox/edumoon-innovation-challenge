'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Business, Widget } from '@/lib/types'

function NewChatbotForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetBusinessId = searchParams.get('businessId') ?? ''

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [businessId, setBusinessId] = useState(presetBusinessId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessId || !name) {
      setError('Please pick a business and give the widget a name')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await api<{ widget: Widget }>('/api/widget', {
        method: 'POST',
        body: {
          title: name,
          description: description || undefined,
          theme: 'AUTO',
          position: 'BOTTOM_RIGHT',
          isEnabled: true,
        },
      })
      router.push(`/dashboard/chatbots/${data.widget.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create widget')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <Link href="/dashboard/chatbots">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to widgets
          </button>
        </Link>

        <div className="mb-8">
          <h2 className="text-3xl font-bold">Create new widget</h2>
          <p className="text-muted-foreground mt-2">
            Deploy an embeddable chat widget for your business site
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-8">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="businessId" className="text-sm font-medium">
                Business
              </Label>
              <select
                id="businessId"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                required
                disabled={isLoading || loadingBusinesses}
                className="mt-2 w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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

            <div>
              <Label htmlFor="name" className="text-sm font-medium">
                Widget name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer support widget"
                required
                disabled={isLoading}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this widget do?"
                disabled={isLoading}
                rows={4}
                className="mt-2 w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isLoading || loadingBusinesses}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create widget'
                )}
              </Button>
              <Link href="/dashboard/chatbots">
                <Button variant="outline" className="border-border hover:bg-secondary/10">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function NewChatbotPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-muted-foreground">Loading…</div>
      }
    >
      <NewChatbotForm />
    </Suspense>
  )
}
