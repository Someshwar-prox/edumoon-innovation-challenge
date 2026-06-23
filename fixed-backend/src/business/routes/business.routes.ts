import { Router } from 'express';
import { businessController } from '../controllers/business.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { createBusinessSchema, updateBusinessSchema } from '../validators/business.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createBusinessSchema), businessController.create);
router.post('/generate-description', businessController.generateDescription);
router.get('/', businessController.list);
router.get('/mine', businessController.getMine);
router.get('/count', businessController.getCount);
router.get('/:id', businessController.getById);
router.put('/:id', validateRequest(updateBusinessSchema), businessController.update);
router.delete('/:id', businessController.delete);

export default router;
