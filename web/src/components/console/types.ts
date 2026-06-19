import type { LucideIcon } from "lucide-react";
import { Globe, FileText, MessageSquare, BarChart3, RefreshCw, AlertCircle } from "lucide-react";

export type EndpointId = "analyze" | "documents" | "chat" | "report";

export interface EndpointMeta {
  id: EndpointId;
  method: "POST";
  path: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  defaultBody: unknown;
}

export const ENDPOINTS: EndpointMeta[] = [
  {
    id: "analyze",
    method: "POST",
    path: "/v1/analyze-website",
    title: "Analyze Website",
    subtitle: "Crawl a URL, extract structured profile, embed page sections.",
    icon: Globe,
    defaultBody: { url: "https://example.com", max_pages: 3, force_recrawl: false },
  },
  {
    id: "documents",
    method: "POST",
    path: "/v1/process-documents",
    title: "Process Documents",
    subtitle: "Upload PDF / DOCX / TXT. Per-file failures are isolated.",
    icon: FileText,
    defaultBody: {},
  },
  {
    id: "chat",
    method: "POST",
    path: "/v1/chat",
    title: "Chat (RAG)",
    subtitle: "Ask a question grounded in website + document knowledge.",
    icon: MessageSquare,
    defaultBody: { question: "Do you ship to Canada?", top_k: 6, score_threshold: 0.3 },
  },
  {
    id: "report",
    method: "POST",
    path: "/v1/generate-report",
    title: "Generate Report",
    subtitle: "AI-readiness score (0-100) with subscores and opportunities.",
    icon: BarChart3,
    defaultBody: { include_documents: true, language: "en" },
  },
];

export interface ConsoleState {
  businessId: string;
  active: EndpointId;
  loading: boolean;
  response: { ok: boolean; status: number; body: unknown } | null;
  error: string | null;
}

export const initialState = (businessId: string): ConsoleState => ({
  businessId,
  active: "analyze",
  loading: false,
  response: null,
  error: null,
});

export { RefreshCw, AlertCircle };
