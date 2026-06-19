import { CodeBlock, TerminalHeader } from "@/components/code-block";
import { CheckCircle2, Github, Globe, type LucideIcon } from "lucide-react";

const PREREQ = [
  "Python 3.10+ (3.11 tested)",
  "~250 MB free disk",
  "A Groq API key — get one at console.groq.com (optional for install, required for LLM endpoints)",
];

const POSIX_INSTALL = `# Clone and enter
git clone https://github.com/Someshwar-prox/edumoon-innovation-challenge
cd edumoon-innovation-challenge

# One-shot setup: venv + deps + Qdrant collections + embedding model
bash install.sh`;

const POSIX_RUN = `# Start everything (Qdrant + FastAPI + static frontend)
bash start.sh`;

const WINDOWS_INSTALL = `:: Clone and enter
git clone https://github.com/Someshwar-prox/edumoon-innovation-challenge
cd edumoon-innovation-challenge

:: One-shot setup
install.bat`;

const WINDOWS_RUN = `:: Start everything
start.bat`;

const CURL_HEALTH = `curl http://127.0.0.1:8000/v1/health
# {"status":"ok","service":"ai-service","version":"0.1.0"}`;

const CURL_CHAT = `curl -X POST http://127.0.0.1:8000/v1/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "business_id": "YOUR-BUSINESS-ID",
    "question": "Do you ship to Canada?"
  }'`;

export default function InstallPage() {
  return (
    <div className="container-prose py-16 sm:py-24">
      <p className="eyebrow">Install &amp; run</p>
      <h1 className="mt-3 text-display-lg text-balance">Three commands. Three minutes.</h1>
      <p className="mt-5 text-lg text-ink-500 max-w-2xl text-pretty">
        AIBridge runs entirely on your laptop. No cloud account, no Docker, no Docker Compose.
        Clone the repo, run the install script, then start it. The browser opens automatically.
      </p>

      <section className="mt-12">
        <p className="eyebrow">Prerequisites</p>
        <ul className="mt-4 space-y-2">
          {PREREQ.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-ink-700">
              <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 text-accent" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <p className="eyebrow">Install</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Pick your OS</h2>
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <TerminalCard os="posix" code={POSIX_INSTALL} title="macOS / Linux / Git Bash on Windows" />
          <TerminalCard os="windows" code={WINDOWS_INSTALL} title="Windows (cmd.exe)" />
        </div>
      </section>

      <section className="mt-14">
        <p className="eyebrow">Run</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Same shape on every OS</h2>
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <TerminalCard os="posix" code={POSIX_RUN} title="macOS / Linux / Git Bash" />
          <TerminalCard os="windows" code={WINDOWS_RUN} title="Windows" />
        </div>
        <p className="mt-4 text-sm text-ink-500 max-w-2xl">
          The script starts Qdrant on :6333, FastAPI on :8000, the static frontend on :5500,
          waits for <code className="text-ink-900 font-mono">/v1/health</code>, and opens
          <code className="text-ink-900 font-mono"> http://127.0.0.1:5500/ </code> in your default browser.
          <strong className="text-ink-900"> Ctrl+C </strong> stops everything.
        </p>
      </section>

      <section className="mt-14">
        <p className="eyebrow">Smoke test</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Hit the API directly</h2>
        <div className="mt-6 space-y-4">
          <CodeBlock language="http" code={CURL_HEALTH} />
          <CodeBlock language="bash" code={CURL_CHAT} />
        </div>
      </section>

      <section className="mt-14">
        <p className="eyebrow">Next steps</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <NextLink
            href="/console"
            title="Try the console"
            body="Click through all four endpoints in your browser with a real business_id."
            icon={Globe}
          />
          <NextLink
            href="https://github.com/Someshwar-prox/edumoon-innovation-challenge"
            title="Read the source"
            body="Every endpoint is ~100 lines. ARCHITECTURE.md and API_CONTRACTS.md are the maps."
            icon={Github}
            external
          />
        </div>
      </section>
    </div>
  );
}

function TerminalCard({
  os,
  code,
  title,
}: {
  os: "posix" | "windows";
  code: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs text-ink-500 mb-2">{title}</p>
      <div className="rounded-2xl overflow-hidden ring-1 ring-ink-200">
        <TerminalHeader os={os} />
        <CodeBlock code={code} />
      </div>
    </div>
  );
}

function NextLink({
  href,
  title,
  body,
  icon: Icon,
  external = false,
}: {
  href: string;
  title: string;
  body: string;
  icon: LucideIcon;
  external?: boolean;
}) {
  const Tag: any = external ? "a" : "a";
  const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Tag href={href} {...props} className="card card-hover p-5 block">
      <div className="size-9 rounded-xl bg-ink-900 text-white flex items-center justify-center">
        <Icon size={17} strokeWidth={2} />
      </div>
      <h3 className="mt-4 font-semibold text-ink-900 tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-500 text-pretty">{body}</p>
    </Tag>
  );
}
