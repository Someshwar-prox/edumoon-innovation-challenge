import { z } from 'zod';

// Cache operation schemas
export const setCacheSchema = z.object({
  key: z.string().min(1, 'Cache key is required'),
  value: z.unknown(),
  ttl: z.number().int().nonnegative().optional() // TTL in seconds
});

export const getCacheSchema = z.object({
  key: z.string().min(1, 'Cache key is required')
});

export const deleteCacheSchema = z.object({
  key: z.string().min(1, 'Cache key is required')
});

// Export schemas
export const cacheValidators = {
  set: setCacheSchema,
  get: getCacheSchema,
  delete: deleteCacheSchema
};