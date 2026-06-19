"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, FileText, Globe as GlobeIcon, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface Citation {
  source_type: "website" | "document";
  source_id: string;
  section_title?: string | null;
  filename?: string | null;
  page_number?: number | null;
  score: number;
  snippet: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  text: string;
  citations?: Citation[];
}

interface SendResult {
  ok: boolean;
  status: number;
  body: { answer?: string; citations?: Citation[]; error?: { message?: string } };
}

interface Props {
  bizId: string;
  loading: boolean;
  send: (question: string, sessionId: string) => Promise<SendResult>;
}

function newSession() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "sess-" + Math.random().toString(36).slice(2);
}

export function ChatPanel({ bizId, loading, send }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const sessionId = useRef<string>(newSession());
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function reset() {
    setMessages([]);
    sessionId.current = newSession();
  }

  async function onSubmit() {
    const q = input.trim();
    if (!q || !bizId) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    const res = await send(q, sessionId.current);
    if (res.ok && res.body.answer !== undefined) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: res.body.answer!, citations: res.body.citations ?? [] },
      ]);
    } else {
      setMessages((m) => [
        ...m,
        { role: "system", text: res.body?.error?.message ?? `Request failed (${res.status})` },
      ]);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">Conversation</p>
        <button onClick={reset} className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 transition-colors">
          <Plus size={11} strokeWidth={2.5} />
          New session
        </button>
      </div>

      <div ref={logRef} className="mt-3 flex-1 overflow-auto rounded-xl ring-1 ring-ink-200 bg-ink-50 p-3 space-y-3 min-h-[300px]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
            <Sparkles size={18} strokeWidth={2} className="text-accent" />
            <p className="mt-3 text-sm text-ink-700">Ask anything grounded in your seeded knowledge base.</p>
            <p className="mt-1 text-xs text-ink-500">Session is stored in localStorage so you can refresh without losing it.</p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              {["What does this business do?", "What's their pricing model?", "Do they have an API?"].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-full bg-white ring-1 ring-ink-200 px-3 py-1 text-xs text-ink-700 hover:bg-ink-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
      </div>

      <div className="mt-3 flex items-end gap-2 rounded-xl ring-1 ring-ink-200 bg-white p-2 focus-within:ring-ink-300 transition-shadow">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask a question…"
          rows={2}
          className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none resize-none px-2 py-1.5"
        />
        <button
          onClick={onSubmit}
          disabled={loading || !input.trim() || !bizId}
          className="btn-primary text-sm shrink-0 disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={2.5} />}
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-ink-900 text-white px-4 py-2.5 text-sm leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === "system") {
    return (
      <div className="max-w-[90%] mx-auto rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-2.5 text-sm text-red-800">
        {msg.text}
      </div>
    );
  }
  return (
    <div>
      <div className="max-w-[90%] rounded-2xl bg-white ring-1 ring-ink-200 px-4 py-3 text-sm text-ink-900 leading-relaxed">
        {msg.text}
      </div>
      {msg.citations && msg.citations.length > 0 && (
        <div className="mt-2 ml-1 flex flex-wrap gap-1.5">
          {msg.citations.slice(0, 4).map((c, i) => {
            const label =
              c.source_type === "document"
                ? c.filename ?? c.source_id.slice(0, 8)
                : c.section_title ?? new URL(c.source_id, "https://x").hostname;
            const Icon = c.source_type === "document" ? FileText : GlobeIcon;
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-white ring-1 px-2.5 py-1 text-[10.5px]",
                  c.source_type === "document"
                    ? "ring-accent-100 text-accent-700"
                    : "ring-ink-200 text-ink-700"
                )}
              >
                <Icon size={10} strokeWidth={2.5} />
                <span className="font-medium">{label}</span>
                <span className="font-mono text-ink-400">{c.score.toFixed(2)}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
