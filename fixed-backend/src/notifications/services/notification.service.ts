import { Notification, NotificationType } from '@prisma/client';
import { notificationRepository } from '../repositories/notification.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  NotificationAllMarkedAsReadEvent,
  NotificationCreatedEvent,
  NotificationDeletedEvent,
  NotificationMarkedAsReadEvent,
  NotificationMarkedAsUnreadEvent,
  NotificationUpdatedEvent,
} from '../events/notification.event';
import { notificationListener } from '../listeners/notification.listener';

export interface CreateNotificationInput {
  title: string;
  message: string;
  type: NotificationType;
  isRead?: boolean;
  businessId?: string;
}

export type UpdateNotificationInput = Partial<Omit<CreateNotificationInput, 'businessId'>>;

export class NotificationService {
  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------
  async getById(id: string): Promise<Notification> {
    const n = await notificationRepository.findById(id);
    if (!n) throw new Error('Notification not found');
    return n;
  }

  async getByBusinessId(businessId: string): Promise<Notification[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return notificationRepository.findByBusinessId(businessId);
  }

  async getUnreadByBusinessId(businessId: string): Promise<Notification[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return notificationRepository.findUnreadByBusinessId(businessId);
  }

  // ---------------------------------------------------------------------------
  // Mutate
  // ---------------------------------------------------------------------------
  async createNotification(businessId: string, data: CreateNotificationInput): Promise<Notification> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const notification = await notificationRepository.createNotification({
      businessId,
      title: data.title,
      message: data.message,
      type: data.type,
      isRead: data.isRead,
    });

    await notificationListener.onNotificationCreated(
      new NotificationCreatedEvent(notification.id, businessId, notification.type),
    );
    return notification;
  }

  async updateNotification(id: string, data: UpdateNotificationInput): Promise<Notification> {
    const existing = await notificationRepository.findById(id);
    if (!existing) throw new Error('Notification not found');

    const updated = await notificationRepository.updateNotification(id, {
      title: data.title,
      message: data.message,
      type: data.type,
      isRead: data.isRead,
      readAt: data.isRead === false ? null : data.isRead === true ? existing.readAt ?? new Date() : undefined,
    });

    await notificationListener.onNotificationUpdated(
      new NotificationUpdatedEvent(updated.id, {
        title: data.title,
        message: data.message,
        type: data.type,
        isRead: data.isRead,
      }),
    );
    return updated;
  }

  async deleteNotification(id: string): Promise<Notification> {
    const existing = await notificationRepository.findById(id);
    if (!existing) throw new Error('Notification not found');
    const deleted = await notificationRepository.deleteNotification(id);
    await notificationListener.onNotificationDeleted(
      new NotificationDeletedEvent(deleted.id),
    );
    return deleted;
  }

  async markAsRead(id: string): Promise<Notification> {
    const existing = await notificationRepository.findById(id);
    if (!existing) throw new Error('Notification not found');
    const updated = await notificationRepository.markAsRead(id);
    await notificationListener.onNotificationMarkedAsRead(
      new NotificationMarkedAsReadEvent(updated.id),
    );
    return updated;
  }

  async markAsUnread(id: string): Promise<Notification> {
    const existing = await notificationRepository.findById(id);
    if (!existing) throw new Error('Notification not found');
    const updated = await notificationRepository.markAsUnread(id);
    await notificationListener.onNotificationMarkedAsUnread(
      new NotificationMarkedAsUnreadEvent(updated.id),
    );
    return updated;
  }

  async markAllAsRead(businessId: string): Promise<{ count: number }> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    const result = await notificationRepository.markAllAsRead(businessId);
    await notificationListener.onNotificationAllMarkedAsRead(
      new NotificationAllMarkedAsReadEvent(businessId, result.count),
    );
    return result;
  }

  // ---------------------------------------------------------------------------
  // Counts
  // ---------------------------------------------------------------------------
  async getCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return notificationRepository.getCountByBusinessId(businessId);
  }

  async getUnreadCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return notificationRepository.getUnreadCountByBusinessId(businessId);
  }
}

export const notificationService = new NotificationService();
