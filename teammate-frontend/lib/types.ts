/**
 * Domain types matching the fixed-backend's Prisma schema + DTOs.
 * The frontend's old mock types are gone — these are what the gateway
 * actually returns.
 */

export type Industry =
  | 'ECOMMERCE'
  | 'SAAS'
  | 'AGENCY'
  | 'EDUCATION'
  | 'CONSULTING'
  | 'LOCAL_BUSINESS'
  | 'OTHER';

export type DocumentType = 'PDF' | 'DOCX' | 'TXT';

export interface Business {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  industry: Industry;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSettings {
  id: string;
  businessId: string;
  timezone: string;
  language: string;
  emailNotifications: boolean;
  analyticsSharing: boolean;
  dataRetentionDays: number;
}

// Auth types live in lib/auth.ts and are re-exported via lib/auth-types.ts
// for ergonomic imports from inside dashboard pages.

export interface DocumentRecord {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: DocumentType;
  url: string;
  extractedText: string | null;
  chunkCount: number;
  isProcessed: boolean;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Website {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  lastCrawled: string | null;
  crawlStatus: string;
  pageCount: number;
  businessId: string;
}

export interface WebsitePage {
  id: string;
  url: string;
  title: string | null;
  content: string | null;
  summary: string | null;
  websiteId: string;
  createdAt: string;
}

export interface KnowledgeBaseStats {
  knowledgeBase: {
    id: string;
    name: string;
    documentCount: number;
    pageCount: number;
    chunkCount: number;
    isReady: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface Audit {
  id: string;
  readinessScore: number;
  businessSummary: string | null;
  aiOpportunities: unknown[] | null;
  automationSuggestions: unknown[] | null;
  estimatedBenefits: Record<string, unknown> | null;
  strengths: unknown[] | null;
  weaknesses: unknown[] | null;
  suggestedSolutions: unknown[] | null;
  expectedRoi: Record<string, unknown> | null;
  businessId: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  sessionToken: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  satisfactionScore: number | null;
  feedback: string | null;
  businessId: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  isFromUser: boolean;
  chatSessionId: string;
  createdAt: string;
}

export type WidgetTheme = 'LIGHT' | 'DARK' | 'AUTO';
export type WidgetPosition =
  | 'BOTTOM_RIGHT'
  | 'BOTTOM_LEFT'
  | 'TOP_RIGHT'
  | 'TOP_LEFT';

export interface Widget {
  id: string;
  title: string;
  slug: string;
  theme: WidgetTheme;
  position: WidgetPosition;
  isEnabled: boolean;
  customCss: string | null;
  businessId: string;
}
