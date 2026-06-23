import { z } from 'zod';
import { Position, Theme } from '@prisma/client';

export const createWidgetSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  theme: z.nativeEnum(Theme).optional(),
  position: z.nativeEnum(Position).optional(),
  isEnabled: z.boolean().optional(),
  customCss: z.string().max(10_000).optional(),
});

export const updateWidgetSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  theme: z.nativeEnum(Theme).optional(),
  position: z.nativeEnum(Position).optional(),
  isEnabled: z.boolean().optional(),
  customCss: z.string().max(10_000).nullable().optional(),
});

export const widgetValidators = {
  create: createWidgetSchema,
  update: updateWidgetSchema,
};
