"use client";

import { RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  title: string;
  hint?: string;
  language: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  onSubmit: () => void;
  loading: boolean;
  ctaLabel: string;
}

export function EndpointBodyEditor({
  title,
  hint,
  language,
  value,
  onChange,
  onReset,
  onSubmit,
  loading,
  ctaLabel,
}: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">{title}</p>
          {hint && <p className="text-xs text-ink-400 mt-0.5 font-mono">{hint}</p>}
        </div>
        <button
          onClick={onReset}
          className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw size={11} strokeWidth={2.5} />
          Reset
        </button>
      </div>

      <div className="mt-3 rounded-xl ring-1 ring-ink-200 bg-ink-900 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">{language}</span>
          <span className="font-mono text-[10px] text-ink-500">{value.length} chars</span>
        </div>
        <textarea
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full bg-transparent text-ink-100 font-mono text-[12.5px] leading-relaxed",
            "p-4 outline-none resize-none min-h-[260px]"
          )}
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={loading}
        className="btn-primary w-full mt-4 disabled:opacity-50"
      >
        <Send size={13} strokeWidth={2.5} />
        {loading ? "Working…" : ctaLabel}
      </button>
    </div>
  );
}
