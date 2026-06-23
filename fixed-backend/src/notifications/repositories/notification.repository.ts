import { prisma } from '../../lib/prisma';
import { Notification, NotificationType } from '@prisma/client';

export class NotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    return prisma.notification.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUnreadByBusinessId(businessId: string): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { businessId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNotification(data: {
    businessId: string;
    title: string;
    message: string;
    type: NotificationType;
    isRead?: boolean;
  }): Promise<Notification> {
    return prisma.notification.create({
      data: {
        businessId: data.businessId,
        title: data.title,
        message: data.message,
        type: data.type,
        isRead: data.isRead ?? false,
      },
    });
  }

  async updateNotification(
    id: string,
    data: Partial<{
      title: string;
      message: string;
      type: NotificationType;
      isRead: boolean;
      readAt: Date | null;
    }>,
  ): Promise<Notification> {
    return prisma.notification.update({ where: { id }, data });
  }

  async deleteNotification(id: string): Promise<Notification> {
    return prisma.notification.delete({ where: { id } });
  }

  async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAsUnread(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { isRead: false, readAt: null },
    });
  }

  async markAllAsRead(businessId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: { businessId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { count: result.count };
  }

  async getCountByBusinessId(businessId: string): Promise<number> {
    return prisma.notification.count({ where: { businessId } });
  }

  async getUnreadCountByBusinessId(businessId: string): Promise<number> {
    return prisma.notification.count({ where: { businessId, isRead: false } });
  }
}

export const notificationRepository = new NotificationRepository();
