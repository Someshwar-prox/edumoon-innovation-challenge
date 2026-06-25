import axios from 'axios';
import { Audit, Prisma } from '@prisma/client';
import { auditRepository } from '../repositories/audit.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import { config } from '../../config';
import logger from '../../utils/logger';
import {
  AuditCreatedEvent,
  AuditDeletedEvent,
  AuditUpdatedEvent,
} from '../events/audit.event';
import { auditListener } from '../listeners/audit.listener';

export interface CreateAuditInput {
  businessId: string;
  readinessScore: number;
  businessSummary?: string;
  aiOpportunities?: unknown[];
  automationSuggestions?: unknown[];
  estimatedBenefits?: Record<string, unknown>;
  strengths?: unknown[];
  weaknesses?: unknown[];
  suggestedSolutions?: unknown[];
  expectedRoi?: Record<string, unknown>;
}

export interface GenerateReportOptions {
  focusAreas?: string[];
  includeDocuments?: boolean;
  language?: string;
}

export interface AiReportResponse {
  report_id?: string;
  score?: number;
  subscores?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  automation_suggestions?: Array<{
    title: string;
    description?: string;
    estimated_hours_saved_per_week?: number;
  }>;
  company_summary?: string;
  business_summary?: string;
  ai_opportunities?: string[];
}

export type UpdateAuditInput = Partial<Omit<CreateAuditInput, 'businessId'>>;

export class AuditService {
  async getById(id: string): Promise<Audit> {
    const a = await auditRepository.findById(id);
    if (!a) throw new Error('Audit not found');
    return a;
  }

  async getByBusinessId(businessId: string): Promise<Audit[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return auditRepository.findByBusinessId(businessId);
  }

  async getLatestByBusinessId(businessId: string): Promise<Audit | null> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return auditRepository.findLatestByBusinessId(businessId);
  }

  async createAudit(data: CreateAuditInput): Promise<Audit> {
    const business = await businessRepository.findById(data.businessId);
    if (!business) throw new Error('Business not found');

    const audit = await auditRepository.createAudit({
      businessId: data.businessId,
      readinessScore: data.readinessScore,
      businessSummary: data.businessSummary,
      aiOpportunities: toJsonArray(data.aiOpportunities),
      automationSuggestions: toJsonArray(data.automationSuggestions),
      estimatedBenefits: toJsonObject(data.estimatedBenefits),
      strengths: toJsonArray(data.strengths),
      weaknesses: toJsonArray(data.weaknesses),
      suggestedSolutions: toJsonArray(data.suggestedSolutions),
      expectedRoi: toJsonObject(data.expectedRoi),
    });

    await auditListener.onAuditCreated(
      new AuditCreatedEvent(audit.id, audit.businessId, audit.readinessScore),
    );
    return audit;
  }

  async updateAudit(id: string, data: UpdateAuditInput): Promise<Audit> {
    const existing = await auditRepository.findById(id);
    if (!existing) throw new Error('Audit not found');

    const audit = await auditRepository.updateAudit(id, {
      readinessScore: data.readinessScore,
      businessSummary: data.businessSummary === undefined ? undefined : data.businessSummary,
      aiOpportunities:
        data.aiOpportunities === undefined
          ? undefined
          : toJsonArray(data.aiOpportunities),
      automationSuggestions:
        data.automationSuggestions === undefined
          ? undefined
          : toJsonArray(data.automationSuggestions),
      estimatedBenefits:
        data.estimatedBenefits === undefined
          ? undefined
          : toJsonObject(data.estimatedBenefits),
      strengths:
        data.strengths === undefined ? undefined : toJsonArray(data.strengths),
      weaknesses:
        data.weaknesses === undefined ? undefined : toJsonArray(data.weaknesses),
      suggestedSolutions:
        data.suggestedSolutions === undefined
          ? undefined
          : toJsonArray(data.suggestedSolutions),
      expectedRoi:
        data.expectedRoi === undefined ? undefined : toJsonObject(data.expectedRoi),
    });

    await auditListener.onAuditUpdated(
      new AuditUpdatedEvent(audit.id, {
        readinessScore: data.readinessScore,
        businessSummary: data.businessSummary,
        aiOpportunities: JSON.stringify(data.aiOpportunities ?? []),
        automationSuggestions: JSON.stringify(data.automationSuggestions ?? []),
        estimatedBenefits: JSON.stringify(data.estimatedBenefits ?? {}),
        strengths: JSON.stringify(data.strengths ?? []),
        weaknesses: JSON.stringify(data.weaknesses ?? []),
        suggestedSolutions: JSON.stringify(data.suggestedSolutions ?? []),
        expectedRoi: JSON.stringify(data.expectedRoi ?? {}),
      }),
    );
    return audit;
  }

  async deleteAudit(id: string): Promise<Audit> {
    const existing = await auditRepository.findById(id);
    if (!existing) throw new Error('Audit not found');
    const audit = await auditRepository.deleteAudit(id);
    await auditListener.onAuditDeleted(new AuditDeletedEvent(audit.id));
    return audit;
  }

  async getCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return auditRepository.countByBusinessId(businessId);
  }

  /**
   * Trigger an AI readiness report from the ai-service and persist the result.
   * Maps the FastAPI `/v1/generate-report` payload into our `Audit` row.
   */
  async generateReport(
    businessId: string,
    options: GenerateReportOptions = {},
  ): Promise<Audit> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.externalApiKey) headers['X-Api-Key'] = config.externalApiKey;

    let aiResponse: { data: AiReportResponse };
    try {
      const aiServiceUrl = config.externalLlmServiceUrl === 'http://localhost:8000' && config.externalDocumentServiceUrl 
        ? config.externalDocumentServiceUrl 
        : config.externalLlmServiceUrl;
      aiResponse = await axios.post<AiReportResponse>(
        `${aiServiceUrl}/v1/generate-report`,
        {
          business_id: businessId,
          focus_areas: options.focusAreas ?? [],
          include_documents: options.includeDocuments ?? true,
          language: options.language ?? 'en',
        },
        { headers, timeout: 120_000 },
      );
    } catch (err: any) {
      logger.error({ err }, 'Failed to generate report from AI service');
      
      let aiError = err.response?.data?.detail || err.response?.data?.error;
      if (typeof aiError === 'object' && aiError?.message) {
        aiError = aiError.message;
      } else if (typeof aiError === 'object') {
        aiError = JSON.stringify(aiError);
      }

      if (err.response?.status === 404) {
        throw new Error(aiError || 'No indexed content found for this business. Please crawl a website or upload documents first.');
      } else if (err.response?.status === 502) {
        throw new Error(`AI model failed: ${aiError || 'Upstream LLM error'}`);
      } else if (err.response?.status === 503) {
        throw new Error(`AI service misconfigured: ${aiError || 'Service unavailable'}`);
      }
      throw new Error(aiError || 'AI readiness service unavailable');
    }

    const data = aiResponse.data;
    const score = Number(data.score ?? 0);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error('AI service returned an invalid readiness score');
    }

    const strengths = data.strengths ?? [];
    const weaknesses = data.weaknesses ?? [];
    const opportunities = data.opportunities ?? data.ai_opportunities ?? [];
    const automationSuggestions = (data.automation_suggestions ?? []).map((s) => ({
      title: s.title,
      description: s.description ?? '',
      estimatedHoursSavedPerWeek: s.estimated_hours_saved_per_week ?? null,
    }));
    const businessSummary =
      data.business_summary ?? data.company_summary ?? null;

    return this.createAudit({
      businessId,
      readinessScore: Math.round(score),
      businessSummary: businessSummary ?? undefined,
      aiOpportunities: opportunities,
      automationSuggestions,
      estimatedBenefits: { subscores: data.subscores ?? {} },
      strengths,
      weaknesses,
      suggestedSolutions: opportunities,
    });
  }
}

function toJsonArray(value: unknown[] | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

function toJsonObject(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

export const auditService = new AuditService();
