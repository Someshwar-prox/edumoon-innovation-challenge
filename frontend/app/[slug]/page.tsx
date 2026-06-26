'use client'

// Public embeddable chat route. Reached at /<business_slug>.
// Looks up the widget by slug (no auth required) and renders a minimal
// chat UI. Memory is bounded by the widget's business — opening
// /manus_ai vs /acme_ai never crosses contexts.

import { use, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Widget } from '@/lib/types'

interface PageProps {
  params: Promise<{ slug: string }>
}

interface PublicMessage {
  id: string
  content: string
  isFromUser: boolean
  chatSessionId?: string
  createdAt?: string
}

export default function PublicWidgetPage({ params }: PageProps) {
  const { slug } = use(params)
  const [widget, setWidget] = useState<Widget | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<PublicMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ widget: Widget }>(`/api/widget/by-slug/${slug}`)
        if (!cancelled) setWidget(data.widget)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Widget not found')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const ensureSession = async (): Promise<string> => {
    if (sessionRef.current) return sessionRef.current
    const data = await api<{ chatSession: { id: string } }>(
      '/api/chat/session',
      {
        method: 'POST',
        body: {
          visitorId: `public-${slug}`,
          widgetId: widget?.id,
        },
      },
    )
    sessionRef.current = data.chatSession.id
    setSessionId(data.chatSession.id)
    return data.chatSession.id
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !widget) return
    setInput('')
    setError(null)
    setSending(true)
    const placeholder: PublicMessage = {
      id: `local-${Date.now()}`,
      content: text,
      isFromUser: true,
    }
    setMessages((m) => [...m, placeholder])
    try {
      const sid = await ensureSession()
      await api(`/api/chat/${sid}/message`, {
        method: 'POST',
        body: { content: text, isFromUser: true },
      })
      // Poll for the bot reply — the gateway proxy is async, so the
      // message lands a moment later. (Streaming the proxy would mean
      // /v1/chat on ai-service, but that endpoint isn't proxied today.)
      const deadline = Date.now() + 30_000
      let botText: string | null = null
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1200))
        const r = await api<{ messages: PublicMessage[] }>(
          `/api/chat/${sid}/messages`,
        )
        const lastAi = [...(r.messages ?? [])]
          .reverse()
          .find((m) => !m.isFromUser)
        if (lastAi) {
          botText = lastAi.content
          break
        }
      }
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          content:
            botText ??
            "I'm still working on a reply — try sending again in a moment.",
          isFromUser: false,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-slate-50">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900">Widget not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            We couldn't find a chatbot for{' '}
            <span className="font-mono">/{slug}</span>. Check the link or ask
            the site owner for the correct URL.
          </p>
        </div>
      </div>
    )
  }

  if (!widget) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> AIBridge
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <header className="px-6 py-5 border-b border-slate-100">
            <h1 className="text-lg font-semibold text-slate-900">
              {widget.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Ask anything about this business — the chatbot answers from its
              own materials.
            </p>
          </header>
          {widget.isEnabled ? (
            <>
              <div className="h-[420px] overflow-y-auto p-6 space-y-4 bg-slate-50/40">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center mt-24">
                    Send a message to start chatting with {widget.title}.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.isFromUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] shadow-sm ${
                          m.isFromUser
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-white border border-slate-100 text-slate-900 rounded-bl-none'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 px-4 py-2.5 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1.5 h-[44px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendMessage()
                }}
                className="border-t border-slate-100 p-4 flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question…"
                  disabled={sending}
                  className="flex-1 h-11 px-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> Send
                </button>
              </form>
              {error && (
                <p className="px-4 pb-3 text-xs text-red-600">{error}</p>
              )}
            </>
          ) : (
            <div className="h-[420px] flex items-center justify-center p-6 bg-slate-50/40">
              <p className="text-sm text-slate-500 text-center">
                This widget is currently disabled by the owner.
              </p>
            </div>
          )}
          {sessionId ? null : null}
        </div>
      </div>
    </div>
  )
}