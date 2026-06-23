import logger from '../../utils/logger';
import {
  NotificationAllMarkedAsReadEvent,
  NotificationCreatedEvent,
  NotificationDeletedEvent,
  NotificationMarkedAsReadEvent,
  NotificationMarkedAsUnreadEvent,
  NotificationUpdatedEvent,
} from '../events/notification.event';

export class NotificationListener {
  async onNotificationCreated(event: NotificationCreatedEvent): Promise<void> {
    try {
      logger.info(
        { notificationId: event.notificationId, businessId: event.businessId, type: event.type },
        'Notification created',
      );
    } catch (err) {
      logger.error('Error in onNotificationCreated listener', err);
    }
  }

  async onNotificationUpdated(event: NotificationUpdatedEvent): Promise<void> {
    try {
      logger.info({ notificationId: event.notificationId }, 'Notification updated');
    } catch (err) {
      logger.error('Error in onNotificationUpdated listener', err);
    }
  }

  async onNotificationDeleted(event: NotificationDeletedEvent): Promise<void> {
    try {
      logger.info({ notificationId: event.notificationId }, 'Notification deleted');
    } catch (err) {
      logger.error('Error in onNotificationDeleted listener', err);
    }
  }

  async onNotificationMarkedAsRead(event: NotificationMarkedAsReadEvent): Promise<void> {
    try {
      logger.info({ notificationId: event.notificationId }, 'Notification marked as read');
    } catch (err) {
      logger.error('Error in onNotificationMarkedAsRead listener', err);
    }
  }

  async onNotificationMarkedAsUnread(event: NotificationMarkedAsUnreadEvent): Promise<void> {
    try {
      logger.info({ notificationId: event.notificationId }, 'Notification marked as unread');
    } catch (err) {
      logger.error('Error in onNotificationMarkedAsUnread listener', err);
    }
  }

  async onNotificationAllMarkedAsRead(event: NotificationAllMarkedAsReadEvent): Promise<void> {
    try {
      logger.info(
        { businessId: event.businessId, count: event.count },
        'All notifications marked as read',
      );
    } catch (err) {
      logger.error('Error in onNotificationAllMarkedAsRead listener', err);
    }
  }
}

export const notificationListener = new NotificationListener();
