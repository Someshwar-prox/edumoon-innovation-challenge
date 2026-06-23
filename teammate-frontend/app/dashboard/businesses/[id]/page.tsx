'use client'

// Next.js 16 made `params` an async dynamic API (it became a Promise so
// streaming SSR can start before route params resolve). Direct property
// access (`params.id`) throws at runtime and is a hard error under
// Turbopack's strict sync-dynamic-apis check. Always unwrap with React.use
// inside the client component — that wires it to Suspense and lets the
// rest of the page render while params are being resolved.
import { use, useEffect, useState } from 'react'
import { ArrowLeft, Upload, FileText, Trash2, Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import type { Business, DocumentRecord } from '@/lib/types'

interface BusinessDetailPageProps {
  params: Promise<{ id: string }>
}

export default function BusinessDetailPage({ params }: BusinessDetailPageProps) {
  const { id: businessId } = use(params)
  const [business, setBusiness] = useState<Business | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [b, d] = await Promise.all([
          api<{ business: Business }>(`/api/business/${businessId}`),
          api<{ documents: DocumentRecord[] }>(`/api/documents?businessId=${businessId}`),
        ])
        if (cancelled) return
        setBusiness(b.business)
        setDocuments(d.documents ?? [])
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Failed to load business',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.currentTarget
    const files = target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('businessId', businessId)
        // The gateway's document route infers the business from the auth'd
        // user; we still pass the id so the URL is unambiguous.
        const created = await api<{ document: DocumentRecord }>(
          '/api/documents/upload',
          { method: 'POST', body: formData },
        )
        setDocuments((prev) => [created.document, ...prev])
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      target.value = ''
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await api(`/api/documents/${docId}`, { method: 'DELETE' })
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl">
        <Link href="/dashboard/businesses">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to businesses
          </button>
        </Link>

        <div className="mb-8">
          <h2 className="text-3xl font-bold">Business profile</h2>
          <p className="text-muted-foreground mt-2">
            Manage your business information and documents
          </p>
        </div>

        {loadError && (
          <div className="mb-6 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Business information</h3>
                <div className="space-y-4">
                  <Field label="Name" value={business?.name} />
                  <Field label="Industry" value={business?.industry} />
                  <Field label="Website" value={business?.websiteUrl ?? undefined} />
                  <Field label="Description" value={business?.description ?? undefined} />
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Documents</h3>
                {uploadError && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-lg mb-4 text-sm">
                    {uploadError}
                  </div>
                )}
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-6 hover:border-primary/50 transition-colors cursor-pointer group">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-muted-foreground group-hover:text-primary mx-auto mb-3 transition-colors" />
                    <p className="font-medium mb-1">
                      {isUploading ? 'Uploading…' : 'Drop files or click to upload'}
                    </p>
                    <p className="text-sm text-muted-foreground">PDF, DOCX, or TXT (max 10MB)</p>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                  />
                </div>

                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{doc.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(doc.size / 1024).toFixed(2)} KB · {doc.isProcessed ? 'processed' : 'pending'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-2 hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No documents uploaded yet. Upload files to power AI analysis.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold mb-4">Quick actions</h3>
                <div className="space-y-3">
                  <Link href={`/dashboard/reports/new?businessId=${businessId}`}>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground justify-start">
                      <Plus className="w-4 h-4 mr-2" />
                      Generate report
                    </Button>
                  </Link>
                  <Link href={`/dashboard/chatbots/new?businessId=${businessId}`}>
                    <Button variant="outline" className="w-full border-border hover:bg-secondary/10 justify-start">
                      <Plus className="w-4 h-4 mr-2" />
                      Create widget
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <label className="text-sm text-muted-foreground">{label}</label>
      <p className="font-medium mt-1">{value ?? '—'}</p>
    </div>
  )
}
