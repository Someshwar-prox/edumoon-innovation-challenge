import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorization.middleware';
import { Role } from '@prisma/client';
import { validateRequest, validateParams } from '../../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const businessIdParam = z.object({ businessId: z.string().min(1) });
const metricParam = z.object({
  businessId: z.string().min(1),
  metricType: z.string().min(1),
});

router.get('/', analyticsController.getAll);

router.post('/', authorize([Role.ADMIN]), ...analyticsController.create);

router.get(
  '/:businessId',
  validateParams(businessIdParam),
  analyticsController.getByBusinessId,
);
router.get(
  '/:businessId/kpis',
  validateParams(businessIdParam),
  analyticsController.getKpis,
);
router.get(
  '/:businessId/count',
  validateParams(businessIdParam),
  analyticsController.getCount,
);
router.get(
  '/:businessId/metric/:metricType',
  validateParams(metricParam),
  analyticsController.getByMetricType,
);
router.get(
  '/:businessId/metric/:metricType/latest',
  validateParams(metricParam),
  analyticsController.getLatest,
);
router.post(
  '/:businessId/retention',
  authorize([Role.ADMIN]),
  validateParams(businessIdParam),
  validateRequest(z.object({ daysToKeep: z.coerce.number().int().min(1) })),
  ...analyticsController.applyRetention,
);

// Routes with `/:id` must come after more specific routes.
const idParam = z.object({ id: z.string().min(1) });
router.put(
  '/:id',
  authorize([Role.ADMIN]),
  validateParams(idParam),
  ...analyticsController.update,
);
router.delete(
  '/:id',
  authorize([Role.ADMIN]),
  validateParams(idParam),
  ...analyticsController.delete,
);

export default router;
