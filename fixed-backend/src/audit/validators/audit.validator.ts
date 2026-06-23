import { z } from 'zod';

const readinessScore = z.number().int().min(0).max(100);

export const createAuditSchema = z.object({
  businessId: z.string().uuid(),
  readinessScore,
  businessSummary: z.string().max(10_000).optional(),
  aiOpportunities: z.array(z.unknown()).optional(),
  automationSuggestions: z.array(z.unknown()).optional(),
  estimatedBenefits: z.record(z.unknown()).optional(),
  strengths: z.array(z.unknown()).optional(),
  weaknesses: z.array(z.unknown()).optional(),
  suggestedSolutions: z.array(z.unknown()).optional(),
  expectedRoi: z.record(z.unknown()).optional(),
});

export const updateAuditSchema = z.object({
  readinessScore: readinessScore.optional(),
  businessSummary: z.string().max(10_000).nullable().optional(),
  aiOpportunities: z.array(z.unknown()).nullable().optional(),
  automationSuggestions: z.array(z.unknown()).nullable().optional(),
  estimatedBenefits: z.record(z.unknown()).nullable().optional(),
  strengths: z.array(z.unknown()).nullable().optional(),
  weaknesses: z.array(z.unknown()).nullable().optional(),
  suggestedSolutions: z.array(z.unknown()).nullable().optional(),
  expectedRoi: z.record(z.unknown()).nullable().optional(),
});

export const generateReportSchema = z.object({
  focusAreas: z.array(z.string()).optional(),
  includeDocuments: z.boolean().optional(),
  language: z.string().length(2).optional(),
});

export const auditValidators = {
  create: createAuditSchema,
  update: updateAuditSchema,
  generate: generateReportSchema,
};
