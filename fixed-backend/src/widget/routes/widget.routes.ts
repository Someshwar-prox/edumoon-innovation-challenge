import { Router } from 'express';
import { widgetController } from '../controllers/widget.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { createWidgetSchema, updateWidgetSchema } from '../validators/widget.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public — the /<slug> embeddable route on the frontend hits this.
router.get('/by-slug/:slug', widgetController.getBySlug);

router.use(authenticate);

router.get('/', widgetController.listByBusinessId);
router.get('/:id', widgetController.getById);
router.post('/', validateRequest(createWidgetSchema), widgetController.create);
router.put('/:id', validateRequest(updateWidgetSchema), widgetController.update);
router.delete('/:id', widgetController.delete);

export default router;