import { z } from 'zod';

export const uploadDocumentSchema = z.object({
  description: z.string().max(500).optional(),
});

export const updateDocumentSchema = z.object({
  description: z.string().max(500).optional(),
  isProcessed: z.boolean().optional(),
});

export const markAsProcessedSchema = z.object({
  extractedText: z.string().optional(),
  chunkCount: z.number().int().nonnegative().optional(),
});

export const documentValidators = {
  upload: uploadDocumentSchema,
  update: updateDocumentSchema,
  markAsProcessed: markAsProcessedSchema,
};
