"use client";

import { motion } from "framer-motion";

export function HeroOrb() {
  return (
    <div className="relative aspect-square w-full max-w-md mx-auto">
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white via-ink-50 to-white ring-1 ring-ink-200 shadow-[0_20px_60px_-20px_rgba(15,15,20,0.18)] overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200/70">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-ink-900" />
              <span className="font-mono text-[11px] text-ink-500">aibridge://demo</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-ink-200" />
              <span className="size-2 rounded-full bg-ink-200" />
              <span className="size-2 rounded-full bg-ink-200" />
            </div>
          </div>
          <div className="flex-1 p-5 space-y-3">
            <ConsoleLine label="business_id" value="9a485ff1-52b3…" tone="muted" delay={0.2} />
            <ConsoleLine label="POST" value="/v1/chat" tone="accent" delay={0.35} />
            <ConsoleLine label="question" value="Do you ship to Canada?" tone="default" delay={0.5} />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 rounded-xl bg-ink-900 text-white p-4 text-[13px] leading-relaxed font-mono"
            >
              <div className="text-ink-400 mb-2 text-[10px] uppercase tracking-[0.18em]">assistant</div>
              Yes — we ship to all Canadian provinces. Standard delivery takes 5–7 business days.
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.4 }}
              className="flex flex-wrap gap-1.5 pt-1"
            >
              <span className="rounded-full bg-ink-100 text-ink-700 px-2.5 py-1 text-[10px] font-mono">website · 0.78</span>
              <span className="rounded-full bg-ink-100 text-ink-700 px-2.5 py-1 text-[10px] font-mono">document · 0.61</span>
            </motion.div>
          </div>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.3, duration: 0.6 }}
        className="absolute -bottom-6 -left-6 rounded-2xl bg-white ring-1 ring-ink-200 shadow-[0_10px_30px_-12px_rgba(15,15,20,0.18)] px-4 py-3 hidden sm:block"
      >
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">score</div>
        <div className="text-2xl font-semibold text-ink-900 tabular-nums">62<span className="text-ink-400">/100</span></div>
      </motion.div>
    </div>
  );
}

function ConsoleLine({
  label,
  value,
  tone = "default",
  delay = 0,
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "accent";
  delay?: number;
}) {
  const color =
    tone === "accent" ? "text-accent-700" : tone === "muted" ? "text-ink-400" : "text-ink-900";
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-baseline gap-2 text-[12.5px] font-mono"
    >
      <span className="text-ink-400">{label}</span>
      <span className={color}>{value}</span>
    </motion.div>
  );
}
