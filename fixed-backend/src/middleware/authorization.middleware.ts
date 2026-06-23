import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Role-based authorization middleware.
 * Usage: authorize([Role.ADMIN, Role.BUSINESS_OWNER])
 */
export const authorize = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole) {
      logger.warn('Authorization failed: No role found on user');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(userRole)) {
      logger.warn(
        `Authorization failed: User role ${userRole} not authorized for this action`,
      );
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
};

/**
 * Ownership middleware: ensures the requesting user owns the resource,
 * unless they are an admin.
 */
export const ownResource = (
  getOwnerIdFn: (req: Request) => Promise<string>,
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (userRole === Role.ADMIN) {
        next();
        return;
      }
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const ownerId = await getOwnerIdFn(req);
      if (userId !== ownerId) {
        logger.warn(`Ownership failed: User ${userId} does not own resource owned by ${ownerId}`);
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
