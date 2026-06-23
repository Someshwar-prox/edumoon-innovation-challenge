import { z } from 'zod';
import { MetricType } from '@prisma/client';

export const METRIC_TYPES = Object.values(MetricType) as [MetricType, ...MetricType[]];

export const createAnalyticsSchema = z.object({
  businessId: z.string().min(1),
  metricType: z.nativeEnum(MetricType),
  metricValue: z.number().finite(),
  labels: z.record(z.unknown()).optional(),
  date: z.coerce.date().optional(),
});

export const updateAnalyticsSchema = z.object({
  metricType: z.nativeEnum(MetricType).optional(),
  metricValue: z.number().finite().optional(),
  labels: z.record(z.unknown()).nullable().optional(),
  date: z.coerce.date().optional(),
});

export const analyticsQuerySchema = z.object({
  metricType: z.nativeEnum(MetricType).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export const retentionSchema = z.object({
  daysToKeep: z.coerce.number().int().min(1).max(3650),
});

export const analyticsValidators = {
  create: createAnalyticsSchema,
  update: updateAnalyticsSchema,
  query: analyticsQuerySchema,
  retention: retentionSchema,
};
