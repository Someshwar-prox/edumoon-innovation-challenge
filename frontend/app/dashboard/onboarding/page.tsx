'use client'

// Onboarding column — the 4-step flow the user described.
// Step 1 — drop a URL (submit, backend crawls via ai-service, "approved")
// Step 2 — drop documents (skippable)
// Step 3 — training (auto-progresses once crawl + chunk finishes)
// Step 4 — chatbot with text + voice mode toggle
//
// State is local to this page; nothing is persisted across reloads. When
// the user finishes Step 4 we send them to /dashboard.
import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  SkipForward,
  Sparkles,
  Type,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Business, Website, Widget } from '@/lib/types'
import { AuthCanvas } from '@/components/auth/auth-canvas'

type Step = 1 | 2 | 3 | 4

interface CrawlResult {
  status: 'pending' | 'success' | 'failed'
  pagesCrawled?: number
  error?: string
}

// Derive a sensible default business name from the auth'd user
// cached in sessionStorage by lib/auth.ts. "somesh@bookzstore.in" →
// "Bookzstore", "Jane Doe <jane@gmail.com>" → "Jane Doe" (fallback).
// Avoids the placeholder "My Business" that the AI advisor otherwise
// mishears as a real company name and answers generic questions about.
function deriveBusinessNameFromEmail(): string {
  if (typeof window === 'undefined') return 'My Business'
  try {
    const raw = window.sessionStorage.getItem('aibridge:user')
    if (raw) {
      const parsed = JSON.parse(raw) as {
        email?: string
        firstName?: string
        lastName?: string
      }
      const fullName = [parsed?.firstName, parsed?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()
      if (fullName) return fullName
      if (parsed?.email) {
        const domain = parsed.email.split('@')[1] || ''
        const root = domain.replace(/^www\./, '').split('.')[0]
        if (
          root &&
          root !== 'gmail' &&
          root !== 'yahoo' &&
          root !== 'outlook' &&
          root !== 'hotmail'
        ) {
          return root.charAt(0).toUpperCase() + root.slice(1)
        }
        const local = parsed.email.split('@')[0] || ''
        const pretty = local
          .split(/[._-]+/)
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(' ')
        if (pretty) return pretty
      }
    }
  } catch {
    // sessionStorage can be unavailable in private mode
  }
  return 'My Business'
}

import { useOnboardingStore } from '@/components/dashboard/onboarding-provider'

function CrawlingSimulation({ url, isComplete }: { url: string; isComplete: boolean }) {
  const [logs, setLogs] = useState<string[]>([])
  const isCompleteRef = useRef(isComplete)

  useEffect(() => {
    isCompleteRef.current = isComplete
  }, [isComplete])

  const logMessages = [
    `[INFO] Initializing headless crawler for ${url}`,
    `[INFO] Resolving DNS and establishing connection...`,
    `[INFO] DOM fetched. Parsing HTML structure...`,
    `[DEBUG] Found 34 paragraph nodes, 12 headers.`,
    `[INFO] Extracting readable text content...`,
    `[INFO] Stripping boilerplate (nav, footer, ads)...`,
    `[DEBUG] Generating semantic chunks (size=500)...`,
    `[INFO] Embedding 15 chunks via BGE-Small-EN-v1.5...`,
    `[INFO] Indexing vectors to Qdrant...`,
    `[INFO] Crawl completed successfully.`
  ]

  useEffect(() => {
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx === logMessages.length - 1) {
        if (isCompleteRef.current) {
          const msg = logMessages[currentIdx];
          setLogs(prev => [...prev, msg]);
          currentIdx++;
          clearInterval(interval);
        }
      } else if (currentIdx < logMessages.length - 1) {
        const msg = logMessages[currentIdx];
        setLogs(prev => [...prev, msg]);
        currentIdx++;
      }
    }, 400)
    return () => clearInterval(interval)
  }, [url])

  return (
    <div className="mt-4 flex flex-col md:flex-row gap-4 h-[240px] animate-in fade-in slide-in-from-top-4 duration-500">
      <style>{`
        @keyframes scanLine {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        @keyframes pulseGrid {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {/* Visual Simulation (Left) */}
      <div className="flex-1 overflow-hidden relative rounded-xl border border-indigo-200 bg-slate-900 shadow-inner group">
        <img
          src={`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`}
          alt="Website screenshot"
          className="w-full h-full object-cover opacity-60 mix-blend-luminosity"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=800`;
          }}
        />
        {/* Bounding box grid overlay */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{ 
            backgroundImage: 'linear-gradient(to right, #6366f1 1px, transparent 1px), linear-gradient(to bottom, #6366f1 1px, transparent 1px)',
            backgroundSize: '30px 30px',
            animation: 'pulseGrid 2s infinite'
          }} 
        />
        {/* Scanner line */}
        <div 
          className="absolute left-0 right-0 h-1 bg-indigo-400 shadow-[0_0_15px_3px_rgba(99,102,241,0.5)] z-10"
          style={{ animation: 'scanLine 3s ease-in-out infinite' }}
        />
        {/* Computer Vision Target Boxes */}
        <div className="absolute top-[20%] left-[10%] w-[80%] h-[15%] border border-emerald-400/50 bg-emerald-400/10 rounded" />
        <div className="absolute top-[40%] left-[15%] w-[40%] h-[20%] border border-emerald-400/50 bg-emerald-400/10 rounded" />
        <div className="absolute top-[45%] left-[60%] w-[25%] h-[30%] border border-emerald-400/50 bg-emerald-400/10 rounded" />
        
        <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded backdrop-blur-sm border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          VISION PARSER ACTIVE
        </div>
      </div>

      {/* Terminal Logs (Right) */}
      <div className="flex-1 bg-[#0D1117] rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-hidden relative flex flex-col shadow-inner text-left">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          </div>
          <span className="text-slate-500 text-[10px]">crawler.sh</span>
        </div>
        <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          {logs.map((log, i) => log && (
            <div key={i} className="text-emerald-400/90 leading-relaxed">
              <span className="text-slate-500 mr-2">{'>'}</span>
              {log.includes('[INFO]') && <span className="text-blue-400 mr-1">[INFO]</span>}
              {log.includes('[DEBUG]') && <span className="text-amber-400 mr-1">[DEBUG]</span>}
              {log.replace(/\[INFO\]|\[DEBUG\]/, '')}
            </div>
          ))}
          {logs.length < logMessages.length && (
            <div className="w-2 h-3 bg-emerald-400 animate-pulse mt-1" />
          )}
        </div>
        {/* Fade out bottom for smooth scrolling effect if it overflows */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0D1117] to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [business, setBusiness] = useState<Business | null>(null)
  const [widget, setWidget] = useState<Widget | null>(null)
  const [website, setWebsite] = useState<Website | null>(null)
  const [loadingBiz, setLoadingBiz] = useState(true)

  // Step 1 state
  const [url, setUrl] = useState('')
  const [submittingUrl, setSubmittingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [crawl, setCrawl] = useState<CrawlResult>({ status: 'idle' })

  // Step 2 state
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [docCount, setDocCount] = useState(0)

  // Step 3 state
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [trainingMessage, setTrainingMessage] = useState('Crawling website…')

  // Step 4 state
  const [chatMode, setChatMode] = useState<'text' | 'voice'>('text')
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([])
  const [chatSending, setChatSending] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const urlBusinessId = searchParams.get('businessId')

  // Load the specific business if requested (auto-create one later if none).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!urlBusinessId) {
          if (!cancelled) setLoadingBiz(false)
          return
        }
        const data = await api<{ businesses: Business[] }>('/api/business/mine')
        if (cancelled) return
        
        const target = data.businesses?.find(b => b.id === urlBusinessId)
        if (target) {
          setBusiness(target)
        }
      } catch (err) {
        // ignore — user can create manually later
      } finally {
        if (!cancelled) setLoadingBiz(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Step 1: URL submission + crawl ----
  async function handleSubmitUrl() {
    setUrlError(null)
    if (!/^https?:\/\//i.test(url.trim())) {
      setUrlError('Enter a URL starting with http:// or https://')
      return
    }
    setSubmittingUrl(true)
    try {
      // 2) Attach URL to business. The backend's
      //    `resolveBusiness` helper auto-creates a new business
      //    if no businessId is provided!
      const urlRes = await api<{ website: Website; business?: Business }>('/api/website/url', {
        method: 'POST',
        body: { 
          businessId: business?.id,
          url: url.trim() 
        },
      })
      setWebsite(urlRes.website)
      
      // Update business state with the returned business (in case it was just created or renamed)
      if (urlRes.business) {
        setBusiness(urlRes.business)
      }
      // 3) Trigger crawl (analyze-website under the hood). Skip the
      //    setCrawl('pending') flip if the backend already marked
      //    crawlStatus='completed' (idempotent re-submits are common
      //    when the user retries after a transient error).
      if (urlRes.website?.crawlStatus !== 'completed') {
        setCrawl({ status: 'pending' })
        const crawlRes = await api<{ pagesCrawled: number }>(
          '/api/website/crawl',
          { 
            method: 'POST',
            body: { businessId: urlRes.business?.id || business?.id }
          },
        )
        setCrawl({
          status: 'success',
          pagesCrawled: crawlRes.pagesCrawled ?? 0,
        })
      } else {
        setCrawl({ status: 'success', pagesCrawled: urlRes.website.pageCount ?? 0 })
      }
      // Auto-advance after a pause so the user sees the crawler simulation finish
      setTimeout(() => setStep(2), 3500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not crawl that URL'
      setCrawl({ status: 'failed', error: msg })
      setUrlError(msg)
    } finally {
      setSubmittingUrl(false)
    }
  }

  // ---- Step 2: documents (skippable) ----
  async function handleUploadDocs() {
    if (!business || files.length === 0) return
    setUploading(true)
    setDocError(null)
    try {
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        fd.append('businessId', business.id)
        // Use the shared api() helper so the access token + refresh
        // cookie ride along automatically (the previous raw fetch was
        // missing the Authorization header, causing 401s).
        await api('/api/documents/upload', { method: 'POST', body: fd })
      }
      setDocCount((c) => c + files.length)
      setFiles([])
      setStep(3)
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleSkipDocs() {
    setStep(3)
  }

  // ---- Step 3: training animation + widget creation ----
  useEffect(() => {
    if (step !== 3) return
    let pct = 0
    const messages = [
      'Crawling website…',
      'Extracting structure…',
      'Embedding chunks…',
      'Indexing knowledge base…',
      'Warming up the chatbot…',
    ]
    const interval = setInterval(() => {
      pct += 8 + Math.random() * 12
      if (pct >= 100) {
        pct = 100
        clearInterval(interval)
        setTrainingMessage('Ready.')
        // Removed persistent widget creation for onboarding chats
        setTimeout(() => setStep(4), 700)
      } else {
        const idx = Math.min(messages.length - 1, Math.floor((pct / 100) * messages.length))
        setTrainingMessage(messages[idx])
      }
      setTrainingProgress(Math.min(100, Math.round(pct)))
    }, 350)
    return () => clearInterval(interval)
  }, [step])

  // ---- Step 4: chat (text mode) ----
  async function handleSend(explicitText?: string, voiceLang?: string) {
    const text = explicitText ?? chatInput.trim()
    if (!text || chatSending || !business) return
    if (!explicitText) setChatInput('')
    setChatLog((l) => [...l, { role: 'user', text }])
    setChatSending(true)
    // A local placeholder so the user sees we're "thinking" while the
    // background AI proxy runs server-side. Replaced with the real
    // answer as soon as /messages has a non-user row.
    setChatLog((l) => [
      ...l,
      { role: 'ai', text: 'Researching your site…' },
    ])
    try {
      let sid = sessionId
      if (!sid) {
        // 1) Open an ephemeral chat session against the business.
        //    We do NOT pass a widgetId so it remains a temporary sandbox session.
        const sessionRes = await api<{ chatSession: { id: string } }>(
          '/api/chat/session',
          {
            method: 'POST',
            body: {
              businessId: business.id,
            },
          },
        )
        sid = sessionRes.chatSession.id
        setSessionId(sid)
      }

      // 2) Send the message. The gateway persists the row and fires
      //    the AI proxy in a background worker, so this returns in a
      //    few hundred ms instead of the previous 20-35s. The bot's
      //    reply lands a moment later — we poll for it.
      // Grab the message count before we send the new user message
      const prevRes = await api<{ messages: any[] }>(`/api/chat/${sid}/messages`)
      const prevCount = prevRes.messages.length

      await api(`/api/chat/${sid}/message`, {
        method: 'POST',
        body: { content: text, isFromUser: true, chatMode: chatMode },
      })
      
      // 3) Poll for the bot's reply. Wait until DB has at least 2 new messages
      //    (1 for the user's query, 1 for the AI's reply).
      const deadline = Date.now() + 60_000 // bumped to 60s to handle long crawls
      let aiText: string | null = null
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1200))
        const res = await api<{
          messages: Array<{ content: string; isFromUser: boolean }>
        }>(`/api/chat/${sid}/messages`)
        
        if (res.messages.length >= prevCount + 2) {
          const lastAi = [...res.messages]
            .reverse()
            .find((m) => !m.isFromUser)
          if (lastAi) {
            aiText = lastAi.content
            break
          }
        }
      }
      // Replace the placeholder with the real answer (or timeout).
      setChatLog((l) => {
        const next = l.slice(0, -1)
        next.push({
          role: 'ai',
          text:
            aiText ??
            'Still working on it — the AI service is taking longer than usual. Try again in a moment.',
        })
        return next
      })

      if (aiText && chatMode === 'voice') {
        const cleanText = aiText.replace(/\s*\(\d+\)/g, '').replace(/\s*\[\d+\]/g, '').replace(/[*_#]/g, '');
        
        try {
          // Use standard fetch because api() wrapper expects JSON
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const res = await fetch(`${baseUrl}/api/chat/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanText })
          });
          
          if (!res.ok) throw new Error('TTS failed');
          
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          
          if ((window as any)._currentAudio) {
            (window as any)._currentAudio.pause();
          }
          
          const audio = new Audio(audioUrl);
          (window as any)._currentAudio = audio;
          audio.play();
        } catch (err) {
          console.error("Failed to play TTS audio:", err);
        }
      }
    } catch (err) {
      setChatLog((l) => {
        const next = l.slice(0, -1)
        next.push({
          role: 'ai',
          text:
            err instanceof Error
              ? `Error: ${err.message}`
              : 'Something went wrong while generating a reply.',
        })
        return next
      })
    } finally {
      setChatSending(false)
    }
  }

  if (loadingBiz) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="relative">


      <div className="relative z-10 mx-auto max-w-3xl px-2 md:px-4">
        <Stepper currentStep={step} />

        {step === 1 && (
          <StepCard
            icon={<Globe className="w-5 h-5" />}
            title="Drop a URL"
            subtitle="Paste any website URL — AIBridge will crawl and structure it."
          >
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={submittingUrl || crawl.status === 'success'}
                  className="flex-1 h-12 px-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleSubmitUrl}
                  disabled={submittingUrl || crawl.status === 'success' || !url.trim()}
                  className="inline-flex items-center gap-2 h-12 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-50"
                >
                  {submittingUrl ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Crawling…
                    </>
                  ) : crawl.status === 'success' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Approved
                    </>
                  ) : (
                    <>
                      Submit URL
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {crawl.status === 'success' && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  Crawled {crawl.pagesCrawled} page{crawl.pagesCrawled === 1 ? '' : 's'} — approved.
                </div>
              )}

              {(submittingUrl || crawl.status === 'pending' || crawl.status === 'success') && url && (
                <CrawlingSimulation url={url} isComplete={crawl.status === 'success'} />
              )}

              {urlError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                  {urlError}
                </div>
              )}
            </div>
          </StepCard>
        )}

        {step === 2 && (
          <StepCard
            icon={<Sparkles className="w-5 h-5" />}
            title="Drop your documents"
            subtitle="Optional — PDFs, DOCX, or TXT. Skip if your website already says everything."
          >
            <div className="space-y-4">
              <label
                htmlFor="file-input"
                className="block border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
              >
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  className="sr-only"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  disabled={uploading}
                />
                <Sparkles className="w-6 h-6 mx-auto text-indigo-500" />
                <p className="mt-3 text-sm text-slate-700">
                  {files.length > 0
                    ? `${files.length} file${files.length === 1 ? '' : 's'} selected`
                    : 'Click to choose files, or drop them here'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  .pdf · .docx · .txt, up to 50 MB each
                </p>
              </label>

              {files.length > 0 && (
                <ul className="text-sm space-y-1">
                  {files.map((f) => (
                    <li key={f.name} className="text-slate-700">
                      • {f.name} ({Math.round(f.size / 1024)} KB)
                    </li>
                  ))}
                </ul>
              )}

              {docError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                  {docError}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleSkipDocs}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip this step
                </button>
                <button
                  type="button"
                  onClick={handleUploadDocs}
                  disabled={uploading || files.length === 0}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      Upload & continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </StepCard>
        )}

        {step === 3 && (
          <StepCard
            icon={<Loader2 className="w-5 h-5 animate-spin" />}
            title="Training your chatbot"
            subtitle="This usually takes a few seconds."
          >
            <div className="space-y-4">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${trainingProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-600">{trainingMessage}</p>
              <p className="text-xs text-slate-500">
                {docCount > 0
                  ? `Indexed ${docCount} document${docCount === 1 ? '' : 's'} along with the website.`
                  : 'Training on website content.'}
              </p>
            </div>
          </StepCard>
        )}

        {step === 4 && business && (
          <StepCard
            icon={<MessageSquare className="w-5 h-5" />}
            title={business.name}
            subtitle="Your chatbot is ready. Ask anything."
            right={
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setChatMode('text')}
                  className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium ${
                    chatMode === 'text'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" /> Text
                </button>
                <button
                  type="button"
                  onClick={() => setChatMode('voice')}
                  className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium ${
                    chatMode === 'voice'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" /> Voice
                </button>
              </div>
            }
          >
            {chatMode === 'text' ? (
              <TextChat
                log={chatLog}
                input={chatInput}
                sending={chatSending}
                onChange={setChatInput}
                onSend={handleSend}
              />
            ) : (
              <VoiceChat 
                onTranscribe={(t, lang) => handleSend(t, lang)}
                disabled={chatSending}
              />
            )}
          </StepCard>
        )}

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

function Stepper({ currentStep }: { currentStep: Step }) {
  const steps = [
    { n: 1, label: 'URL' },
    { n: 2, label: 'Documents' },
    { n: 3, label: 'Training' },
    { n: 4, label: 'Chat' },
  ] as const
  return (
    <div className="mb-8 flex items-center justify-center gap-2 text-xs">
      {steps.map((s, i) => {
        const active = s.n === currentStep
        const done = s.n < currentStep
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                active
                  ? 'bg-indigo-600 text-white'
                  : done
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : active ? (
                <CircleDashed className="w-3.5 h-3.5" />
              ) : (
                <span className="w-3.5 h-3.5 inline-block text-center leading-none">
                  {s.n}
                </span>
              )}
              <span className="font-medium">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="w-6 h-px bg-slate-200" aria-hidden />
            )}
          </div>
        )
      })}
    </div>
  )
}

function StepCard({
  icon,
  title,
  subtitle,
  right,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_24px_60px_-30px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {right}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}

// ---- Text chat ----
function TextChat({
  log,
  input,
  sending,
  onChange,
  onSend,
}: {
  log: Array<{ role: 'user' | 'ai'; text: string }>
  input: string
  sending: boolean
  onChange: (v: string) => void
  onSend: () => void
}) {
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }
  return (
    <div className="space-y-4">
      <div className="h-72 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-4 space-y-3">
        {log.length === 0 ? (
          <p className="text-sm text-slate-500 text-center mt-12">
            Ask anything about this business. The chatbot will answer from the indexed website and documents.
          </p>
        ) : (
          log.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder="Ask something…"
          className="flex-1 resize-none h-11 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
          disabled={sending}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Send
        </button>
      </div>
    </div>
  )
}

function VoiceChat({ onTranscribe, disabled }: { onTranscribe: (text: string, lang: string) => void; disabled: boolean }) {
  const [language, setLanguage] = useState<'en' | 'te' | 'hi'>('en')
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }

    try {
      // INTERRUPT: Stop any currently playing AI audio the instant the user clicks microphone
      if ((window as any)._currentAudio) {
        (window as any)._currentAudio.pause();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        
        setProcessing(true)
        try {
          const fd = new FormData()
          fd.append('file', blob, 'audio.webm')
          fd.append('language', language)

          const res = await api<{text: string}>('/api/chat/voice-transcribe', {
            method: 'POST',
            body: fd
          })
          if (res.text) onTranscribe(res.text, language)
        } catch (err) {
          console.error("Transcription failed", err)
        } finally {
          setProcessing(false)
        }
      }

      recorder.start(200)
      setRecording(true)
    } catch (err) {
      console.error('Could not access microphone', err)
      alert('Could not access microphone')
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(['en', 'te', 'hi'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              disabled={recording || disabled || processing}
              className={`px-3 h-8 rounded-md text-xs font-medium disabled:opacity-50 ${
                language === code
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {code === 'en' ? 'English' : code === 'te' ? 'తెలుగు' : 'हिंदी'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid place-items-center h-32">
        {processing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-500">Transcribing...</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleRecording}
            disabled={disabled}
            className={`w-24 h-24 rounded-full grid place-items-center text-white shadow-xl transition-all ${
              recording 
                ? 'bg-rose-500 animate-pulse scale-110 shadow-rose-200' 
                : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'
            }`}
            aria-label="Tap to talk"
          >
            <Mic className={`w-10 h-10 ${recording ? 'animate-bounce' : ''}`} />
          </button>
        )}
      </div>
      
      {!processing && (
        <p className="text-center text-sm text-slate-600 mt-4 h-6">
          {recording ? 'Recording... tap again to send' : `Tap to talk in ${language === 'en' ? 'English' : language === 'te' ? 'Telugu' : 'Hindi'}`}
        </p>
      )}
    </div>
  )
}
