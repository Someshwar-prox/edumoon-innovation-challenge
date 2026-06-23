import { z } from 'zod';

// Prisma's Industry enum is the source of truth; mirror it here for runtime validation.
export const INDUSTRIES = [
  'ECOMMERCE',
  'SAAS',
  'AGENCY',
  'EDUCATION',
  'CONSULTING',
  'LOCAL_BUSINESS',
  'OTHER',
] as const;

// Free-text → enum normaliser. The form sends raw strings like
// "Technology" / "Healthcare" / "Finance" when the dropdown isn't
// being used (legacy clients, curl, future mobile app, etc.). We
// coerce the obvious ones into the closest enum value rather than
// 400'ing. Anything that doesn't match falls through to "OTHER".
const INDUSTRY_ALIASES: Record<string, (typeof INDUSTRIES)[number]> = {
  technology: 'SAAS',
  tech: 'SAAS',
  software: 'SAAS',
  'saas': 'SAAS',
  startup: 'SAAS',
  healthcare: 'EDUCATION',
  health: 'EDUCATION',
  medical: 'EDUCATION',
  finance: 'CONSULTING',
  fintech: 'SAAS',
  banking: 'CONSULTING',
  consulting: 'CONSULTING',
  education: 'EDUCATION',
  'e-commerce': 'ECOMMERCE',
  ecommerce: 'ECOMMERCE',
  retail: 'ECOMMERCE',
  shop: 'ECOMMERCE',
  store: 'ECOMMERCE',
  agency: 'AGENCY',
  marketing: 'AGENCY',
  creative: 'AGENCY',
  restaurant: 'LOCAL_BUSINESS',
  cafe: 'LOCAL_BUSINESS',
  local: 'LOCAL_BUSINESS',
};

function normaliseIndustry(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  const trimmed = input.trim();
  if (!trimmed) return 'OTHER';
  const upper = trimmed.toUpperCase();
  if ((INDUSTRIES as readonly string[]).includes(upper)) return upper;
  return INDUSTRY_ALIASES[trimmed.toLowerCase()] ?? 'OTHER';
}

const industrySchema = z.preprocess(normaliseIndustry, z.enum(INDUSTRIES));

export const createBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  description: z.string().max(2000).optional(),
  websiteUrl: z.string().url('Invalid URL').optional(),
  industry: industrySchema,
  contactEmail: z.string().email('Invalid email address').optional(),
  contactPhone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(2000).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  industry: industrySchema.optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listBusinessesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  industry: industrySchema.optional(),
  name: z.string().min(1).optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
});

export const businessValidators = {
  create: createBusinessSchema,
  update: updateBusinessSchema,
  listQuery: listBusinessesQuerySchema,
};
