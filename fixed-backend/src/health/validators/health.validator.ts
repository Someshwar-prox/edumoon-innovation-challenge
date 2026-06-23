import { z } from 'zod';

// Health check response schema
export const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number(),
  checks: z.record(
    z.object({
      status: z.enum(['healthy', 'unhealthy']),
      message: z.string().optional(),
      responseTime: z.number().optional()
    })
  )
});

// Export schema
export const healthValidators = {
  check: healthCheckSchema
};