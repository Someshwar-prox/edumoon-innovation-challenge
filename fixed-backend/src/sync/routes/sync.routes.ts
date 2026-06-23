import { Router } from 'express';
import { syncController } from '../controllers/sync.controller';
import { validateRequest, validateParams } from '../../middleware/validation.middleware';
import { createSyncJobSchema, updateSyncJobSchema } from '../validators/sync.validator';
import { authenticate } from '../../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const idParam = z.object({ id: z.string().min(1) });
const statusParam = z.object({ status: z.string().min(1) });
const typeParam = z.object({ type: z.string().min(1) });

router.get('/', syncController.getByBusinessId);
router.get('/count', syncController.getCount);
router.post('/', validateRequest(createSyncJobSchema), syncController.create);

// High-level sync endpoints
router.post('/website', syncController.startWebsiteSync);
router.post('/document', syncController.startDocumentSync);
router.post('/knowledge-base', syncController.startKnowledgeBaseSync);

// Parametric routes last
router.get(
  '/status/:status',
  validateParams(statusParam),
  syncController.getByBusinessIdAndStatus,
);
router.get(
  '/type/:type/latest',
  validateParams(typeParam),
  syncController.getLatestByBusinessIdAndType,
);
router.put('/:id', validateParams(idParam), validateRequest(updateSyncJobSchema), syncController.update);
router.delete('/:id', validateParams(idParam), syncController.delete);
router.get('/:id', validateParams(idParam), syncController.getById);

export default router;
