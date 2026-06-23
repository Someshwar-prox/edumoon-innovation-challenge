'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function NewBusinessPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    industry: '',
    website: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleGenerateDescription = async () => {
    if (!formData.name && !formData.website) return
    setIsGenerating(true)
    setError(null)
    try {
      const data = await api<{ description: string }>('/api/businesses/generate-description', {
        method: 'POST',
        body: { url: formData.website, name: formData.name },
      })
      if (data?.description) {
        setFormData(prev => ({ ...prev, description: data.description }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate description')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // The gateway's POST /api/business expects {name, industry,
      // websiteUrl, description}. The form fields are "name",
      // "industry", "website" — rename before sending.
      const payload = {
        name: formData.name,
        industry: formData.industry || 'OTHER',
        websiteUrl: formData.website 
          ? (formData.website.startsWith('http') ? formData.website : `https://${formData.website}`)
          : undefined,
        description: formData.description || undefined,
      }

      // Use the shared api() helper so the access token (Authorization
      // header) and refreshToken cookie are sent automatically, and
      // 401s trigger a silent refresh + retry. Raw fetch() here was
      // the root cause of the "Not signed in" error on this page.
      const data = await api<{ business?: { id?: string }; id?: string }>(
        '/api/businesses',
        { method: 'POST', body: payload },
      )

      // Gateway returns {business: {...}}; the page route expected a flat id.
      const bizId = data?.business?.id ?? data?.id
      if (bizId) {
        // Brief settle so the new business row is committed before the
        // /[id] page tries to load it (otherwise the user sees "not
        // found" flicker on slow connections).
        await new Promise((r) => setTimeout(r, 200))
        router.push(`/dashboard/businesses/${bizId}`)
      } else {
        router.push('/dashboard/businesses')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        {/* Header */}
        <Link href="/dashboard/businesses">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Businesses
          </button>
        </Link>

        <div className="mb-8">
          <h2 className="text-3xl font-bold">Create New Business</h2>
          <p className="text-muted-foreground mt-2">Set up your business profile to get started with AI readiness analysis</p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-lg border border-border p-8">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-sm font-medium">
                Business Name *
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Acme Corporation"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="mt-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGenerating || (!formData.name && !formData.website)}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Auto Generate
                </button>
              </div>
              <textarea
                id="description"
                name="description"
                placeholder="Tell us about your business..."
                value={formData.description}
                onChange={handleChange}
                disabled={isLoading || isGenerating}
                rows={4}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <Label htmlFor="industry" className="text-sm font-medium">
                Industry
              </Label>
              <select
                id="industry"
                name="industry"
                value={formData.industry}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, industry: e.target.value }))
                  setError(null)
                }}
                disabled={isLoading}
                className="mt-2 w-full h-10 px-3 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select an industry…</option>
                <option value="ECOMMERCE">E-commerce</option>
                <option value="SAAS">SaaS / Software</option>
                <option value="AGENCY">Agency / Creative</option>
                <option value="EDUCATION">Education</option>
                <option value="CONSULTING">Consulting / Professional services</option>
                <option value="LOCAL_BUSINESS">Local business</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="website" className="text-sm font-medium">
                Website URL
              </Label>
              <Input
                id="website"
                name="website"
                placeholder="https://example.com"
                value={formData.website}
                onChange={handleChange}
                disabled={isLoading}
                className="mt-2"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Business'
                )}
              </Button>
              <Link href="/dashboard/businesses">
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
