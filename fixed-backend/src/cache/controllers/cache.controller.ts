import { Request, Response, NextFunction } from 'express';
import { setCacheSchema, getCacheSchema, deleteCacheSchema } from '../validators/cache.validator';
import { cacheService } from '../services/cache.service';
import logger from '../../utils/logger';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorization.middleware';
import { Role } from '@prisma/client';

// Cache controller
export class CacheController {
  // Set value in cache
  async set(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = setCacheSchema.parse(req.body);

      if (req.user?.role !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      await cacheService.set(validatedData.key, validatedData.value, validatedData.ttl);

      return res.status(200).json({
        message: `Cache set successfully for key '${validatedData.key}'`,
      });
    } catch (error) {
      logger.error('Cache set failed', error);
      return next(error);
    }
  }

  // Get value from cache
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = getCacheSchema.parse(req.params);
      const value = await cacheService.get<unknown>(validatedData.key);

      if (value === null) {
        return res.status(404).json({ error: `Cache miss for key '${validatedData.key}'` });
      }

      return res.status(200).json({
        key: validatedData.key,
        value,
        cached: true,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Delete value from cache
  async del(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = deleteCacheSchema.parse(req.params);

      if (req.user?.role !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const result = await cacheService.del(validatedData.key);

      return res.status(200).json({
        message: `Cache delete successful for key '${validatedData.key}' (${result} item(s) removed)`,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Check if key exists in cache
  async exists(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const exists = await cacheService.exists(key);

      return res.status(200).json({ key, exists });
    } catch (error) {
      return next(error);
    }
  }

  // Get cache info (admin only)
  async info(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
      const info = await cacheService.info();
      return res.status(200).json({ info });
    } catch (error) {
      return next(error);
    }
  }

  // Flush all cache (admin only)
  async flushall(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
      await cacheService.flushall();
      return res.status(200).json({ message: 'Cache flushed successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // Get TTL for key
  async ttl(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const ttl = await cacheService.ttl(key);
      return res.status(200).json({ key, ttl });
    } catch (error) {
      return next(error);
    }
  }
}

export const cacheController = new CacheController();
// Re-export to keep existing imports working
export { authorize };
