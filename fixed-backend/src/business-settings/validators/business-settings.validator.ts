import { z } from 'zod';

export const updateBusinessSettingsSchema = z
  .object({
    timezone: z.string().min(1).max(60).optional(),
    language: z.string().min(2).max(8).optional(),
    emailNotifications: z.boolean().optional(),
    analyticsSharing: z.boolean().optional(),
    dataRetentionDays: z.number().int().min(1).max(3650).optional(),
  })
  .strict();

export const businessSettingsValidators = {
  update: updateBusinessSettingsSchema,
};
