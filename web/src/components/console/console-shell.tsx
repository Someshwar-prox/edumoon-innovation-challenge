"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, uuidv4 } from "@/lib/api";
import {
  ENDPOINTS,
  initialState,
  type ConsoleState,
  type EndpointId,
} from "./types";
import { EndpointTabs } from "./endpoint-tabs";
import { EndpointBodyEditor } from "./endpoint-body-editor";
import { ResponseViewer } from "./response-viewer";
import { ConsoleHeader } from "./console-header";
import { ChatPanel } from "./chat-panel";

export function ConsoleShell() {
  const [bizId, setBizId] = useState<string>("");
  const [active, setActive] = useState<EndpointId>("analyze");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ConsoleState["response"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<"unknown" | "ok" | "down">("unknown");
  const [bodies, setBodies] = useState<Record<EndpointId, string>>(() => ({
    analyze: JSON.stringify(ENDPOINTS[0].defaultBody, null, 2),
    documents: "",
    chat: JSON.stringify(ENDPOINTS[2].defaultBody, null, 2),
    report: JSON.stringify(ENDPOINTS[3].defaultBody, null, 2),
  }));
  const seq = useRef(0);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("aibridge:business_id") : null;
    setBizId(stored || uuidv4());
  }, []);

  useEffect(() => {
    if (bizId) {
      try {
        window.localStorage.setItem("aibridge:business_id", bizId);
      } catch {}
    }
  }, [bizId]);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const r = await fetch(API_BASE + "/v1/health");
        if (cancelled) return;
        setHealth(r.ok ? "ok" : "down");
      } catch {
        if (!cancelled) setHealth("down");
      }
    }
    check();
    const id = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const onRandom = useCallback(() => {
    const id = uuidv4();
    setBizId(id);
    setResponse(null);
    setError(null);
  }, []);

  const onResetBody = useCallback(() => {
    const ep = ENDPOINTS.find((e) => e.id === active)!;
    setBodies((b) => ({ ...b, [active]: JSON.stringify(ep.defaultBody, null, 2) }));
  }, [active]);

  async function sendAnalyze() {
    if (!bizId) return;
    let body: any;
    try {
      body = JSON.parse(bodies.analyze || "{}");
    } catch (e: any) {
      setError("Invalid JSON in request body: " + e.message);
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const r = await fetch(API_BASE + "/v1/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: bizId, ...body }),
      });
      const data = await r.json().catch(() => ({}));
      setResponse({ ok: r.ok, status: r.status, body: data });
    } catch (e: any) {
      setError(networkErr(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendDocuments(files: File[]) {
    if (!bizId) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    const fd = new FormData();
    fd.append("business_id", bizId);
    for (const f of files) fd.append("files", f);
    try {
      const r = await fetch(API_BASE + "/v1/process-documents", {
        method: "POST",
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      setResponse({ ok: r.ok, status: r.status, body: data });
    } catch (e: any) {
      setError(networkErr(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendChat(
    question: string,
    sessionId: string
  ): Promise<{
    ok: boolean;
    status: number;
    body: { answer?: string; citations?: any[]; error?: { message?: string } };
  }> {
    if (!bizId) {
      return { ok: false, status: 0, body: { error: { message: "missing business_id" } } };
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(API_BASE + "/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: bizId,
          question,
          session_id: sessionId,
          top_k: 6,
          score_threshold: 0.3,
        }),
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, body: data };
    } catch (e: any) {
      return { ok: false, status: 0, body: { error: { message: networkErr(e) } } };
    } finally {
      setLoading(false);
    }
  }

  async function sendReport() {
    if (!bizId) return;
    let body: any;
    try {
      body = JSON.parse(bodies.report || "{}");
    } catch (e: any) {
      setError("Invalid JSON in request body: " + e.message);
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const r = await fetch(API_BASE + "/v1/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: bizId, ...body }),
      });
      const data = await r.json().catch(() => ({}));
      setResponse({ ok: r.ok, status: r.status, body: data });
    } catch (e: any) {
      setError(networkErr(e));
    } finally {
      setLoading(false);
    }
  }

  function networkErr(e: any): string {
    const msg = String(e?.message ?? e);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return `Network error: cannot reach ${API_BASE}. Is FastAPI running on port 8000?`;
    }
    return msg;
  }

  return (
    <div className="container-prose py-12 sm:py-16">
      <ConsoleHeader
        bizId={bizId}
        onBizIdChange={setBizId}
        onRandom={onRandom}
        health={health}
      />

      <EndpointTabs active={active} onChange={setActive} />

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          {active === "analyze" && (
            <EndpointBodyEditor
              title="Request body"
              hint="POST /v1/analyze-website"
              language="json"
              value={bodies.analyze}
              onChange={(v) => setBodies((b) => ({ ...b, analyze: v }))}
              onReset={onResetBody}
              onSubmit={sendAnalyze}
              loading={loading}
              ctaLabel="Analyze website"
            />
          )}
          {active === "documents" && (
            <DocumentUploader onSubmit={sendDocuments} loading={loading} />
          )}
          {active === "report" && (
            <EndpointBodyEditor
              title="Request body"
              hint="POST /v1/generate-report"
              language="json"
              value={bodies.report}
              onChange={(v) => setBodies((b) => ({ ...b, report: v }))}
              onReset={onResetBody}
              onSubmit={sendReport}
              loading={loading}
              ctaLabel="Generate report"
            />
          )}
        </div>

        <div className="card p-5 min-h-[420px] flex flex-col">
          {active === "chat" ? (
            <ChatPanel bizId={bizId} send={sendChat} loading={loading} />
          ) : (
            <ResponseViewer loading={loading} response={response} error={error} />
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-ink-400 text-center">
        business_id is stored in your browser&apos;s localStorage. Click 🎲 for a fresh tenant.
      </p>
    </div>
  );
}

function DocumentUploader({
  onSubmit,
  loading,
}: {
  onSubmit: (files: File[]) => Promise<void>;
  loading: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">Request</p>
      <h3 className="mt-1 font-semibold text-ink-900">Upload files</h3>
      <p className="mt-1 text-sm text-ink-500">PDF / DOCX / TXT. Per-file failures are isolated.</p>
      <div
        className="mt-5 rounded-xl border-2 border-dashed border-ink-200 hover:border-ink-300 transition-colors p-6 text-center cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          setFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length === 0 ? (
          <div className="text-sm text-ink-500">Drop files here or click to select</div>
        ) : (
          <ul className="text-sm text-ink-700 text-left space-y-1">
            {files.map((f) => (
              <li key={f.name} className="font-mono text-xs">
                {f.name} · {(f.size / 1024).toFixed(1)} KB
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        disabled={loading || files.length === 0}
        onClick={() => onSubmit(files)}
        className="btn-primary w-full mt-5 disabled:opacity-50"
      >
        {loading ? "Uploading…" : `Process ${files.length || ""} file${files.length === 1 ? "" : "s"}`.trim()}
      </button>
    </div>
  );
}
