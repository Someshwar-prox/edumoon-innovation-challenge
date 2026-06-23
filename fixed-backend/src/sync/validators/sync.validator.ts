import { z } from 'zod';

export const SYNC_TYPES = ['website', 'document', 'knowledge_base'] as const;
export const SYNC_STATUSES = ['pending', 'in_progress', 'completed', 'failed'] as const;

export const createSyncJobSchema = z.object({
  type: z.enum(SYNC_TYPES).default('website'),
});

export const updateSyncJobSchema = z.object({
  status: z.enum(SYNC_STATUSES).optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
  pagesProcessed: z.number().int().nonnegative().optional(),
  documentsProcessed: z.number().int().nonnegative().optional(),
});

export const syncValidators = {
  create: createSyncJobSchema,
  update: updateSyncJobSchema,
};
