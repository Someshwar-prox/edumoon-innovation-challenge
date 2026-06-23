import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { createNotificationSchema, updateNotificationSchema } from '../validators/notification.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Static routes first (before `/:id` patterns)
router.get('/', notificationController.getByBusinessId);
router.get('/unread', notificationController.getUnread);
router.get('/count', notificationController.getCount);
router.get('/unread/count', notificationController.getUnreadCount);
router.post('/read-all', notificationController.markAllAsRead);

router.post('/', validateRequest(createNotificationSchema), notificationController.create);

// Per-id routes
router.get('/:id', notificationController.getById);
router.put('/:id', validateRequest(updateNotificationSchema), notificationController.update);
router.delete('/:id', notificationController.delete);
router.post('/:id/read', notificationController.markAsRead);
router.post('/:id/unread', notificationController.markAsUnread);

export default router;
