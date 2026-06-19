import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200/70 mt-24">
      <div className="container-prose py-10 flex flex-col sm:flex-row gap-6 justify-between text-sm text-ink-500">
        <div className="space-y-2">
          <div className="font-semibold text-ink-900">AIBridge</div>
          <p className="max-w-sm">Local-first AI microservice for small and medium businesses. FastAPI · Qdrant · BGE · Groq.</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Link href="/install" className="hover:text-ink-900">Install</Link>
          <Link href="/console" className="hover:text-ink-900">Console</Link>
          <Link href="/chat-widget-demo" className="hover:text-ink-900">Widget demo</Link>
          <a href="https://github.com/Someshwar-prox/edumoon-innovation-challenge" target="_blank" rel="noopener noreferrer" className="hover:text-ink-900">GitHub</a>
        </div>
        <div className="text-ink-400">© 2026 · Built by Someshwar</div>
      </div>
    </footer>
  );
}
