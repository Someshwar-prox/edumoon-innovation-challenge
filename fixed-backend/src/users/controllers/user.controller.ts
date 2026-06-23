import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import {
  updateUserSchema,
  updatePasswordSchema,
  listUsersQuerySchema,
} from '../validators/user.validator';
import { userService } from '../services/user.service';
import logger from '../../utils/logger';

const SENSITIVE_FIELDS = [
  'passwordHash',
  'verificationToken',
  'verificationTokenExpiry',
  'resetToken',
  'resetTokenExpiry',
] as const;

type StrippedUser = Omit<
  Awaited<ReturnType<typeof userService.getUserById>>,
  (typeof SENSITIVE_FIELDS)[number]
>;

function stripSensitive<T extends Record<string, unknown>>(user: T): StrippedUser {
  const copy: Record<string, unknown> = { ...user };
  for (const field of SENSITIVE_FIELDS) {
    delete copy[field];
  }
  return copy as unknown as StrippedUser;
}

export class UserController {
  // GET /api/users/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

      const userId = req.user?.id;
      const userRole = req.user?.role;
      if (userId !== id && userRole !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json({ user: stripSensitive(user) });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/users — admin only
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      const skip = (query.page - 1) * query.limit;

      const result = await userService.getUsers(skip, query.limit, {
        role: query.role,
        isVerified: query.isVerified,
        searchTerm: query.searchTerm,
      });

      const users = result.users.map((u) => stripSensitive(u));

      return res.status(200).json({
        users,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          pages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/users/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateUserSchema.parse(req.body);

      const userId = req.user?.id;
      const userRole = req.user?.role;
      if (userId !== id && userRole !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Only admins can change roles
      if (data.role && userRole !== Role.ADMIN) {
        return res.status(403).json({ error: 'Only admins can change roles' });
      }

      const user = await userService.updateUser(id, data);
      return res.status(200).json({
        message: 'User updated successfully',
        user: stripSensitive(user),
      });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/users/:id — self or admin
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      if (userId !== id && userRole !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await userService.deleteUser(id);
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // PATCH /api/users/:id/verify — admin only (handled by router guard too)
  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await userService.verifyUser(id);
      return res.status(200).json({
        message: 'User verified successfully',
        user: stripSensitive(user),
      });
    } catch (error) {
      return next(error);
    }
  }

  // PATCH /api/users/:id/password — self only
  async updatePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (userId !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const body = updatePasswordSchema.parse(req.body);
      await userService.updatePassword(id, body.currentPassword, body.newPassword);
      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
      logger.error('Update password failed', error);
      return next(error);
    }
  }

  // GET /api/users/count — admin only
  async getCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await userService.getUserCount();
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }
}

export const userController = new UserController();
