import { z } from 'zod';
import { NotificationType } from '@prisma/client';

export const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.nativeEnum(NotificationType),
  isRead: z.boolean().optional(),
  businessId: z.string().uuid().optional(),
});

export const updateNotificationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  isRead: z.boolean().optional(),
});

export const notificationValidators = {
  create: createNotificationSchema,
  update: updateNotificationSchema,
};
