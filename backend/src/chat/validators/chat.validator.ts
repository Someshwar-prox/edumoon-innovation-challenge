import { z } from 'zod';

// Chat session creation schema — visitor id is optional because it's
// normally derived from a cookie / header.
export const createChatSessionSchema = z.object({
  visitorId: z.string().min(1).optional(),
  businessId: z.string().min(1).optional(),
  widgetId: z.string().min(1).optional(),
});

// Chat message creation schema
export const createChatMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  isFromUser: z.boolean().default(true),
  chatMode: z.enum(['text', 'voice']).optional().default('text'),
  includeLiveWeb: z.boolean().optional().default(false),
});

// End-session schema (used when a visitor finishes a chat and submits feedback)
export const endChatSessionSchema = z.object({
  satisfactionScore: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
});

export const chatValidators = {
  createSession: createChatSessionSchema,
  createMessage: createChatMessageSchema,
  endSession: endChatSessionSchema,
};
