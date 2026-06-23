import { z } from 'zod';

export const websiteUrlSchema = z.object({
  url: z.string().url('Invalid URL'),
});

export const updateWebsiteSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
});

export const websiteValidators = {
  url: websiteUrlSchema,
  update: updateWebsiteSchema,
};
