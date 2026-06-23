import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest, validateParams } from '../../middleware/validation.middleware';
import { createAuditSchema, generateReportSchema, updateAuditSchema } from '../validators/audit.validator';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const idParam = z.object({ id: z.string().min(1) });
const businessParam = z.object({ businessId: z.string().min(1) });

router.get('/', auditController.getAll);

router.post('/', validateRequest(createAuditSchema), auditController.create);
router.post(
  '/generate/:businessId',
  validateParams(businessParam),
  validateRequest(generateReportSchema),
  auditController.generate,
);
router.get(
  '/business/:businessId',
  validateParams(businessParam),
  auditController.getByBusinessId,
);
router.get(
  '/business/:businessId/latest',
  validateParams(businessParam),
  auditController.getLatest,
);
router.get(
  '/business/:businessId/count',
  validateParams(businessParam),
  auditController.getCount,
);

// `/:id` routes come last so they don't shadow the `/business/:businessId` group.
router.get('/:id', validateParams(idParam), auditController.getById);
router.put('/:id', validateParams(idParam), validateRequest(updateAuditSchema), auditController.update);
router.delete('/:id', validateParams(idParam), auditController.delete);

export default router;
