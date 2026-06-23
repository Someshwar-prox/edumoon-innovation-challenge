import { Router } from 'express';
import { jobController } from '../controllers/job.controller';
import { validateRequest, validateParams } from '../../middleware/validation.middleware';
import { createJobSchema, updateJobSchema, failJobSchema } from '../validators/job.validator';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorization.middleware';
import { Role } from '@prisma/client';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createJobSchema), jobController.create);
router.get('/pending', jobController.getPending);

// Static routes must come BEFORE the parametric `/:id` routes to avoid
// `pending` being treated as an id.
router.get('/business', jobController.getByBusinessId);
router.get('/business/count', jobController.getCountByBusinessId);

const typeStatusParam = z.object({
  type: z.string().min(1).max(100),
});

router.get(
  '/type/:type',
  validateParams(typeStatusParam),
  jobController.getByType,
);
router.get(
  '/type/:type/count',
  validateParams(typeStatusParam),
  jobController.getCountByType,
);

router.get(
  '/status/:status',
  validateParams(typeStatusParam),
  jobController.getByStatus,
);
router.get(
  '/status/:status/count',
  validateParams(typeStatusParam),
  jobController.getCountByStatus,
);

router.get('/count', authorize([Role.ADMIN]), jobController.getCount);
router.get('/:id', jobController.getById);
router.put('/:id', validateRequest(updateJobSchema), jobController.update);
router.delete('/:id', jobController.delete);
router.post('/:id/start', jobController.start);
router.post('/:id/complete', jobController.complete);
router.post('/:id/fail', validateRequest(failJobSchema), jobController.fail);

export default router;
