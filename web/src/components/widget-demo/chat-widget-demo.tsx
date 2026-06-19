"use client";

import Script from "next/script";
import { Check, Copy, Sparkles, Code2, Globe, MessageSquare, type LucideIcon } from "lucide-react";
import { useState } from "react";

const SAMPLE_BUSINESS = "99999999-aaaa-bbbb-cccc-000000000001";

export function ChatWidgetDemo() {
  const [copied, setCopied] = useState(false);

  const embedSnippet = `<!-- Drop this anywhere on your site -->
<script
  src="/aibridge-widget.js"
  data-business-id="${SAMPLE_BUSINESS}"
  data-title="Ask Acme"
  defer
></script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <div className="container-prose py-12 sm:py-16">
      <p className="eyebrow">Embeddable chat widget</p>
      <h1 className="mt-3 text-display-lg text-balance">
        One script tag. Your business, answered.
      </h1>
      <p className="mt-4 text-lg text-ink-500 max-w-2xl text-pretty">
        AIBridge ships a tiny drop-in widget that turns any website into a Q&amp;A surface grounded
        in your business&apos;s own content. Open the bubble in the corner — that&apos;s the live widget.
      </p>

      <div className="mt-10 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <div className="rounded-2xl ring-1 ring-ink-200 bg-white p-8 min-h-[480px]">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span className="size-2 rounded-full bg-ink-300" />
              your-customer-site.com
            </div>
            <div className="mt-6 space-y-4">
              <div className="text-display-md text-ink-900 leading-tight">
                <span className="text-ink-400">A demo page that hosts</span>
                <br />
                the AIBridge chat widget.
              </div>
              <p className="text-ink-500 max-w-md">
                The chat bubble in the corner is the actual widget, calling
                <code className="font-mono text-ink-900"> POST /v1/chat </code>
                against a demo business_id. Ask it anything.
              </p>
              <div className="pt-4 flex flex-wrap gap-2">
                <Pill icon={Sparkles}>Live · no setup</Pill>
                <Pill icon={Globe}>Vanilla JS</Pill>
                <Pill icon={MessageSquare}>Citations inline</Pill>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl ring-1 ring-ink-200 bg-ink-900 text-white p-6">
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <Code2 size={13} strokeWidth={2} />
              <span className="font-mono uppercase tracking-[0.18em]">embed snippet</span>
            </div>
            <pre className="mt-4 text-[12.5px] leading-relaxed font-mono text-ink-100 overflow-x-auto">
{embedSnippet}
            </pre>
            <button
              onClick={copy}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 ring-1 ring-white/15 px-3 py-1.5 text-xs text-white transition-colors"
            >
              {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
              {copied ? "Copied" : "Copy snippet"}
            </button>
            <p className="mt-5 text-xs text-ink-400 leading-relaxed">
              The widget reads <code className="font-mono text-ink-200">data-business-id</code> and
              calls <code className="font-mono text-ink-200">POST /v1/chat</code> on every send.
              Session id is stored in <code className="font-mono text-ink-200">sessionStorage</code>,
              so a refresh doesn&apos;t lose the thread.
            </p>
          </div>

          <div className="mt-4 rounded-2xl ring-1 ring-ink-200 bg-white p-6">
            <h3 className="font-semibold text-ink-900">How it works</h3>
            <ol className="mt-3 space-y-2 text-sm text-ink-700">
              <li><span className="font-mono text-ink-400 mr-2">1.</span> Customer drops the script on their site.</li>
              <li><span className="font-mono text-ink-400 mr-2">2.</span> Visitor opens the bubble, types a question.</li>
              <li><span className="font-mono text-ink-400 mr-2">3.</span> Widget POSTs <code className="text-ink-900 font-mono">/v1/chat</code> with their business_id.</li>
              <li><span className="font-mono text-ink-400 mr-2">4.</span> FastAPI retrieves, Groq answers, citations flow back.</li>
            </ol>
          </div>
        </div>
      </div>

      <Script src="/aibridge-widget.js" data-business-id={SAMPLE_BUSINESS} data-title="Ask AIBridge" strategy="afterInteractive" />
    </div>
  );
}

function Pill({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 ring-1 ring-ink-200 px-2.5 py-1 text-xs text-ink-700">
      <Icon size={11} strokeWidth={2.5} />
      {children}
    </span>
  );
}
