"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Zap, ZapOff } from "lucide-react";

interface Props {
  bizId: string;
  onBizIdChange: (v: string) => void;
  onRandom: () => void;
  health: "unknown" | "ok" | "down";
}

export function ConsoleHeader({ bizId, onBizIdChange, onRandom, health }: Props) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(bizId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <div className="mb-8 sm:mb-10">
      <p className="eyebrow">Console</p>
      <div className="mt-3 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-display-md text-balance">Drive every endpoint from your browser.</h1>
          <p className="mt-3 text-ink-500 max-w-2xl">
            Pick an endpoint, edit the request body, hit send. Responses are real — they hit the FastAPI
            service running on <code className="font-mono text-ink-900">127.0.0.1:8000</code>.
          </p>
        </div>
        <HealthPill health={health} />
      </div>

      <div className="mt-6 card p-3 flex items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500 shrink-0 pl-2">
          business_id
        </label>
        <input
          value={bizId}
          onChange={(e) => onBizIdChange(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-transparent font-mono text-sm text-ink-900 outline-none placeholder:text-ink-300"
          placeholder="click 🎲 to generate"
        />
        <button onClick={copy} className="btn-ghost text-xs shrink-0" aria-label="Copy business_id">
          {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </button>
        <button onClick={onRandom} className="btn-secondary text-xs shrink-0">
          <RefreshCw size={12} strokeWidth={2.5} />
          Random
        </button>
      </div>
    </div>
  );
}

function HealthPill({ health }: { health: "unknown" | "ok" | "down" }) {
  const [spin, setSpin] = useState(false);
  useEffect(() => {
    setSpin(true);
    const t = setTimeout(() => setSpin(false), 800);
    return () => clearTimeout(t);
  }, [health]);
  const dot =
    health === "ok"
      ? "bg-emerald-500"
      : health === "down"
      ? "bg-red-500"
      : "bg-amber-500 animate-pulse-soft";
  const label = health === "ok" ? "API healthy" : health === "down" ? "API unreachable" : "Checking…";
  const Icon = health === "ok" ? Zap : ZapOff;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 shrink-0 self-start lg:self-auto">
      <span className={`size-1.5 rounded-full ${dot}`} />
      <Icon size={12} strokeWidth={2.5} className={spin ? "animate-spin" : ""} />
      <span>{label}</span>
      <span className="text-ink-400">·</span>
      <span className="font-mono text-ink-500">:8000</span>
    </div>
  );
}
