'use client'

import { use, useEffect, useState } from 'react'
import { ArrowLeft, Send, Copy, Trash2, Check } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import type { Widget, ChatMessage } from '@/lib/types'

interface ChatbotDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ChatbotDetailPage({ params }: ChatbotDetailPageProps) {
  const { id: widgetId } = use(params)
  const [widget, setWidget] = useState<Widget | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api<{ widget: Widget }>(`/api/widget/${widgetId}`)
        if (!cancelled) setWidget(data.widget)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load widget')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [widgetId])

  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    // Load persisted chat session if exists
    const storageKey = `aibridge:preview-session:${widgetId}`
    const savedSessionId = localStorage.getItem(storageKey)
    if (savedSessionId) {
      setSessionId(savedSessionId)
      // Fetch its messages
      api<{ messages: ChatMessage[] }>(`/api/chat/${savedSessionId}/messages`)
        .then(data => {
          if (data.messages) setMessages(data.messages)
        })
        .catch(() => {
          // If 404/expired, clear it
          localStorage.removeItem(storageKey)
          setSessionId(null)
        })
    }
  }, [widgetId])

  const sendMessage = async () => {
    if (!inputValue.trim()) return
    const text = inputValue
    setInputValue('')
    setError(null)
    setIsLoading(true)

    // Optimistically add the user message
    setMessages(prev => [...prev, { id: 'temp-' + Date.now(), content: text, isFromUser: true } as ChatMessage])

    try {
      let currentSessionId = sessionId
      if (!currentSessionId) {
        const session = await api<{ chatSession: { id: string } }>(
          '/api/chat/session',
          {
            method: 'POST',
            body: { visitorId: `widget-${widgetId}`, widgetId },
          },
        )
        currentSessionId = session.chatSession.id
        setSessionId(currentSessionId)
        localStorage.setItem(`aibridge:preview-session:${widgetId}`, currentSessionId)
      }

      await api(`/api/chat/${currentSessionId}/message`, {
        method: 'POST',
        body: { content: text, isFromUser: true },
      })

      // Poll for the AI's reply
      const deadline = Date.now() + 40_000
      let foundReply = false
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1200))
        const all = await api<{ messages: ChatMessage[] }>(
          `/api/chat/${currentSessionId}/messages`,
        )
        const msgs = all.messages ?? []
        setMessages(msgs)
        
        // Check if the last message is from the AI
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg && !lastMsg.isFromUser) {
          foundReply = true
          break
        }
      }

      if (!foundReply) {
        setError('AI service is taking longer than usual. Please try again.')
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage()
  }

  const embedCode = `<!-- AIBridge Chatbot -->
<div id="aibridge-chatbot"></div>
<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/chatbot-widget.js"></script>
<script>
  AIBridgeChatbot.init({ widgetId: '${widgetId}' });
</script>`

  const copyEmbedCode = () => {
    void navigator.clipboard.writeText(embedCode)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="p-8 h-screen overflow-hidden flex flex-col">
      <div className="max-w-4xl w-full mx-auto flex flex-col h-full">
        <Link href="/dashboard/chatbots">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to chatbots
          </button>
        </Link>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{widget?.title ?? 'Chat widget'}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {widget ? (
                <>
                  Public URL:{' '}
                  <a
                    className="font-mono text-indigo-600 hover:underline"
                    href={`/${widget.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    /{widget.slug}
                  </a>
                </>
              ) : (
                <>Widget ID: {widgetId}</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-border hover:bg-secondary/10"
              onClick={copyEmbedCode}
            >
              {isCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {isCopied ? 'Copied!' : 'Embed code'}
            </Button>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {loadError}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
          <div className="lg:col-span-3 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-12">
                  Ask a question to start a conversation. Answers are grounded in your
                  uploaded documents and crawled pages via the ai-service.
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isFromUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-sm ${
                      message.isFromUser
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted/30 text-foreground rounded-bl-none border border-border/50'
                    }`}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary/20 px-4 py-2 rounded-lg rounded-bl-none">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4 bg-background/50">
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message…"
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              {error && (
                <p className="text-xs text-destructive mt-2">{error}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-3">Widget info</h3>
              <div className="space-y-3 text-sm">
                <Row label="Status">
                  <span className="inline-block px-2 py-1 bg-green-500/10 text-green-600 rounded text-xs">
                    {widget?.isEnabled ? 'Active' : 'Disabled'}
                  </span>
                </Row>
                <Row label="Theme" value={widget?.theme} />
                <Row label="Position" value={widget?.position} />
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-2">Installation</h3>
              <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">
                Copy and paste this snippet just before the closing <code>&lt;/body&gt;</code> tag on your website to embed this chatbot.
              </p>
              <div className="relative bg-muted/50 rounded-md p-3 text-[11px] font-mono overflow-x-auto border border-border/50">
                <pre className="text-muted-foreground">{embedCode}</pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 h-6 px-2 bg-background shadow-sm hover:bg-muted"
                  onClick={copyEmbedCode}
                >
                  {isCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                  {isCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="font-semibold mb-3">Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 hover:bg-destructive/10 justify-start text-xs text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete widget
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      {children ?? <p className="font-medium">{value ?? '—'}</p>}
    </div>
  )
}
