"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }
  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-ink-400 ring-1 ring-white/10">
          {language}
        </span>
        <button
          onClick={onCopy}
          aria-label="Copy code"
          className="rounded-md bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-2 py-1 text-ink-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
        >
          {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-2xl bg-ink-900 text-ink-100 ring-1 ring-ink-800 p-5 sm:p-6 text-[13px] leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function TerminalHeader({ os }: { os: "posix" | "windows" }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10 bg-ink-900 rounded-t-2xl">
      <span className="size-2.5 rounded-full bg-white/15" />
      <span className="size-2.5 rounded-full bg-white/15" />
      <span className="size-2.5 rounded-full bg-white/15" />
      <span className="ml-3 inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-400">
        <Terminal size={11} strokeWidth={2} />
        {os === "posix" ? "~/aibridge — bash" : "C:\\aibridge — cmd"}
      </span>
    </div>
  );
}
