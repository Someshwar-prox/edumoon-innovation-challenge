import { z } from 'zod';

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const readySchema = z.object({
  isReady: z.boolean(),
});

export const knowledgeBaseValidators = {
  create: createKnowledgeBaseSchema,
  update: updateKnowledgeBaseSchema,
  ready: readySchema,
};
