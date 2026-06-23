import { Router } from 'express';
import { knowledgeBaseController } from '../controllers/knowledge-base.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
  readySchema,
} from '../validators/knowledge-base.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', knowledgeBaseController.getByBusinessId);
router.get('/stats', knowledgeBaseController.getStats);

router.post('/', validateRequest(createKnowledgeBaseSchema), knowledgeBaseController.create);
router.put('/', validateRequest(updateKnowledgeBaseSchema), knowledgeBaseController.update);
router.delete('/', knowledgeBaseController.delete);

router.post('/document', knowledgeBaseController.addDocument);
router.delete('/document', knowledgeBaseController.removeDocument);
router.post('/page', knowledgeBaseController.addPage);
router.delete('/page', knowledgeBaseController.removePage);

router.post('/ready', validateRequest(readySchema), knowledgeBaseController.setReady);

export default router;
