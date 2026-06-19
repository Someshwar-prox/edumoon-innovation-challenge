"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  loading: boolean;
  response: { ok: boolean; status: number; body: unknown } | null;
  error: string | null;
}

export function ResponseViewer({ loading, response, error }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(response.body, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  if (loading) {
    return (
      <EmptyState>
        <Loader2 size={20} strokeWidth={2} className="animate-spin text-ink-400" />
        <p className="mt-3 text-sm text-ink-500">Calling FastAPI…</p>
      </EmptyState>
    );
  }

  if (error) {
    return (
      <div className="flex-1">
        <ResponseHeader ok={false} status={0} />
        <div className="mt-3 rounded-xl ring-1 ring-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle size={16} strokeWidth={2} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <EmptyState>
        <p className="text-sm text-ink-400">No response yet.</p>
        <p className="mt-1 text-xs text-ink-400">Send a request from the left.</p>
      </EmptyState>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ResponseHeader ok={response.ok} status={response.status} />
      <div className="mt-3 flex items-center justify-end">
        <button
          onClick={copy}
          className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 transition-colors"
        >
          {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <pre
        className={cn(
          "mt-2 flex-1 overflow-auto rounded-xl ring-1 bg-ink-50 p-4",
          "font-mono text-[12px] leading-relaxed text-ink-900",
          response.ok ? "ring-ink-200" : "ring-red-200"
        )}
      >
        <code>{JSON.stringify(response.body, null, 2)}</code>
      </pre>
    </div>
  );
}

function ResponseHeader({ ok, status }: { ok: boolean; status: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">Response</p>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono font-medium",
          ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"
        )}
      >
        <span className={cn("size-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-red-500")} />
        {status || "ERR"}
      </span>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[260px]">
      {children}
    </div>
  );
}
