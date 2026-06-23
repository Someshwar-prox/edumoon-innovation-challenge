import { z } from 'zod';
import { JobStatus } from '@prisma/client';

export const createJobSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  payload: z.record(z.unknown()).optional(),
  scheduledAt: z.coerce.date().optional(),
  businessId: z.string().uuid().optional(),
});

export const updateJobSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(100).optional(),
  payload: z.record(z.unknown()).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(JobStatus).optional(),
});

export const failJobSchema = z.object({
  errorMessage: z.string().min(1).max(2000),
});

export const jobValidators = {
  create: createJobSchema,
  update: updateJobSchema,
  fail: failJobSchema,
};
