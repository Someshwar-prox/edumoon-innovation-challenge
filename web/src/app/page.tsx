import Link from "next/link";
import { ArrowRight, Sparkles, FileText, MessageSquare, BarChart3, Globe, Workflow, ShieldCheck } from "lucide-react";
import { EndpointCard } from "@/components/endpoint-card";
import { HeroOrb } from "@/components/hero-orb";

import type { LucideIcon } from "lucide-react";
const ENDPOINTS: { method: "POST"; path: string; title: string; body: string; icon: LucideIcon }[] = [
  {
    method: "POST",
    path: "/v1/analyze-website",
    title: "Crawl any business website",
    body: "Bounded BFS crawler extracts services, products, FAQs, contact info. Page sections land in your private vector store.",
    icon: Globe,
  },
  {
    method: "POST",
    path: "/v1/process-documents",
    title: "Index your PDFs, DOCX, TXT",
    body: "Recursive chunker + BGE embeddings. Per-file failures are isolated — a bad PDF never kills the batch.",
    icon: FileText,
  },
  {
    method: "POST",
    path: "/v1/chat",
    title: "Answer in your business's voice",
    body: "Retrieval-augmented chat grounded in website + documents. Every answer comes with numbered citations.",
    icon: MessageSquare,
  },
  {
    method: "POST",
    path: "/v1/generate-report",
    title: "Score your AI readiness",
    body: "Aggregates everything into a 0–100 score with subscores, strengths, weaknesses, and concrete automation suggestions.",
    icon: BarChart3,
  },
];

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Local-first by design",
    body: "Your data never leaves your machine. No cloud account, no Docker, no surprise bills.",
  },
  {
    icon: Workflow,
    title: "Drop-in for any stack",
    body: "Four REST endpoints. The same shape works whether you call from a Next.js widget, a Slack bot, or a CRM webhook.",
  },
  {
    icon: Sparkles,
    title: "Citations, not hallucinations",
    body: "Every answer shows its sources. The report surfaces weak spots the LLM would otherwise paper over.",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <Pillars />
      <Endpoints />
      <ClosingCTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-accent-100/40 blur-3xl pointer-events-none" />
      <div className="container-prose relative pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-ink-200 bg-white/80 backdrop-blur px-3 py-1 mb-6">
              <span className="size-1.5 rounded-full bg-accent animate-pulse-soft" />
              <span className="text-xs font-medium text-ink-700">Built for the Edumoon Innovation Challenge · 2026</span>
            </div>
            <h1 className="text-display-xl text-balance text-ink-900">
              The AI microservice
              <br />
              your consulting team can ship this week.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-ink-500 max-w-prose text-pretty">
              AIBridge crawls a business website, indexes its documents, answers questions grounded in both,
              and produces an AI-readiness score. Local. Open. Four REST endpoints. No cloud account required.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/install" className="btn-primary">
                Install in 3 minutes
                <ArrowRight size={15} strokeWidth={2} />
              </Link>
              <Link href="/console" className="btn-secondary">
                Try the console
              </Link>
              <a
                href="https://github.com/Someshwar-prox/edumoon-innovation-challenge"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-sm"
              >
                View source
              </a>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <dt className="eyebrow">Endpoints</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">4</dd>
              </div>
              <div>
                <dt className="eyebrow">Tests</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">69</dd>
              </div>
              <div>
                <dt className="eyebrow">Install</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">~3 min</dd>
              </div>
            </dl>
          </div>
          <div className="lg:col-span-5 animate-fade-up [animation-delay:120ms]">
            <HeroOrb />
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section className="border-y border-ink-200/70 bg-white/60">
      <div className="container-prose py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Why AIBridge</p>
          <h2 className="mt-3 text-display-md text-ink-900 text-balance">
            Built for small teams who don't have an AI engineer.
          </h2>
          <p className="mt-4 text-ink-500 text-pretty">
            AIBridge sits between a raw LLM and your real business knowledge. It does the boring parts —
            crawling, chunking, embedding, retrieval — so your consultants can ship value instead of plumbing.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="card card-hover p-6">
              <div className="size-9 rounded-xl bg-ink-900 text-white flex items-center justify-center">
                <p.icon size={17} strokeWidth={2} />
              </div>
              <h3 className="mt-5 font-semibold text-ink-900 tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm text-ink-500 text-pretty leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Endpoints() {
  return (
    <section className="container-prose py-20 sm:py-28">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
        <div className="max-w-2xl">
          <p className="eyebrow">The four endpoints</p>
          <h2 className="mt-3 text-display-md text-ink-900 text-balance">
            Each one is independent. Each one is production-ready.
          </h2>
        </div>
        <Link href="/console" className="btn-ghost text-sm self-start">
          Try them in the console
          <ArrowRight size={15} strokeWidth={2} />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {ENDPOINTS.map((e) => (
          <EndpointCard key={e.path} {...e} />
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="container-prose pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-ink-900 text-white p-10 sm:p-16">
        <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent-500/30 blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-300">Ready to try?</p>
          <h3 className="mt-3 text-display-md text-balance">
            Three commands. One open-source repo. Four REST endpoints you can call tonight.
          </h3>
          <pre className="mt-8 rounded-xl bg-black/40 ring-1 ring-white/10 p-4 text-sm font-mono overflow-x-auto">
{`git clone https://github.com/Someshwar-prox/edumoon-innovation-challenge
cd edumoon-innovation-challenge
bash install.sh && bash start.sh`}
          </pre>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/install" className="btn-primary bg-white text-ink-900 hover:bg-ink-100">
              Full install guide
            </Link>
            <Link href="/chat-widget-demo" className="btn-secondary bg-transparent text-white ring-white/20 hover:bg-white/10">
              See the widget
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
