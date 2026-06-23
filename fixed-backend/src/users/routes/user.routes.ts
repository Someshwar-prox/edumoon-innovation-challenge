import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  updateUserSchema,
  updatePasswordSchema,
  listUsersQuerySchema,
} from '../validators/user.validator';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorization.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user by ID
router.get('/:id', userController.getById);

// Get users (admin only)
router.get('/', authorize([Role.ADMIN]), userController.getAll);

// Update user
router.put(
  '/:id',
  validateRequest(updateUserSchema),
  userController.update,
);

// Delete user (admin only)
router.delete(
  '/:id',
  authorize([Role.ADMIN]),
  userController.delete,
);

// Verify user (admin only)
router.patch(
  '/:id/verify',
  authorize([Role.ADMIN]),
  userController.verify,
);

// Update user password
router.patch(
  '/:id/password',
  validateRequest(updatePasswordSchema),
  userController.updatePassword,
);

// Get user count (admin only)
router.get(
  '/count',
  authorize([Role.ADMIN]),
  userController.getCount,
);

export default router;
