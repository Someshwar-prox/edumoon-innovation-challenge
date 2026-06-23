import { Request, Response, NextFunction } from 'express';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  createNotificationSchema,
  updateNotificationSchema,
} from '../validators/notification.validator';
import { notificationService } from '../services/notification.service';

export class NotificationController {
  // POST /api/notifications
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createNotificationSchema.parse(req.body);

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let businessId = body.businessId;
      if (!businessId) {
        const business = await businessRepository.findByUserId(userId);
        if (!business) return res.status(404).json({ error: 'Business not found' });
        businessId = business.id;
      }

      const notification = await notificationService.createNotification(businessId, body);
      return res.status(201).json({
        message: 'Notification created successfully',
        notification,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/notifications — list for the auth'd user's business
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const business = await businessRepository.findByUserId(userId);
      if (!business) return res.status(404).json({ error: 'Business not found' });
      const notifications = await notificationService.getByBusinessId(business.id);
      return res.status(200).json({ notifications });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/notifications/unread
  async getUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const business = await businessRepository.findByUserId(userId);
      if (!business) return res.status(404).json({ error: 'Business not found' });
      const notifications = await notificationService.getUnreadByBusinessId(business.id);
      return res.status(200).json({ notifications });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/notifications/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const notification = await notificationService.getById(id);
      return res.status(200).json({ notification });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/notifications/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = updateNotificationSchema.parse(req.body);
      const notification = await notificationService.updateNotification(id, body);
      return res.status(200).json({
        message: 'Notification updated successfully',
        notification,
      });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/notifications/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await notificationService.deleteNotification(id);
      return res.status(200).json({ message: 'Notification deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/notifications/:id/read
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const notification = await notificationService.markAsRead(id);
      return res.status(200).json({
        message: 'Notification marked as read',
        notification,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/notifications/:id/unread
  async markAsUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const notification = await notificationService.markAsUnread(id);
      return res.status(200).json({
        message: 'Notification marked as unread',
        notification,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/notifications/read-all
  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const business = await businessRepository.findByUserId(userId);
      if (!business) return res.status(404).json({ error: 'Business not found' });
      const result = await notificationService.markAllAsRead(business.id);
      return res.status(200).json({
        message: `${result.count} notifications marked as read`,
        count: result.count,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/notifications/count
  async getCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const business = await businessRepository.findByUserId(userId);
      if (!business) return res.status(404).json({ error: 'Business not found' });
      const count = await notificationService.getCount(business.id);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/notifications/unread/count
  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const business = await businessRepository.findByUserId(userId);
      if (!business) return res.status(404).json({ error: 'Business not found' });
      const count = await notificationService.getUnreadCount(business.id);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }
}

export const notificationController = new NotificationController();
