import { Router, Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { cacheController } from '../controllers/cache.controller';
import { setCacheSchema, getCacheSchema, deleteCacheSchema } from '../validators/cache.validator';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorization.middleware';

// Local validation helper. Defined before use to avoid the TS2448
// "used before declaration" error.
function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({ ...req.body, ...req.params, ...req.query });
      next();
    } catch (error) {
      next(error);
    }
  };
}

const router = Router();

// Cache routes require authentication
router.use(authenticate);

// Set value in cache
router.post(
  '/set',
  validateRequest(setCacheSchema),
  cacheController.set,
);

// Get value from cache
router.get(
  '/get/:key',
  validateRequest(getCacheSchema),
  cacheController.get,
);

// Delete value from cache
router.delete(
  '/del/:key',
  validateRequest(deleteCacheSchema),
  cacheController.del,
);

// Check if key exists in cache
router.get(
  '/exists/:key',
  cacheController.exists,
);

// Get cache info (admin only)
router.get(
  '/info',
  authorize(['ADMIN']),
  cacheController.info,
);

// Flush all cache (admin only — destructive)
router.post(
  '/flushall',
  authorize(['ADMIN']),
  cacheController.flushall,
);

// Get TTL for key
router.get(
  '/ttl/:key',
  cacheController.ttl,
);

export default router;
