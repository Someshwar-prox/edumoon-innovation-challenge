import { Router } from 'express';
import { businessSettingsController } from '../controllers/business-settings.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { updateBusinessSettingsSchema } from '../validators/business-settings.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/me', businessSettingsController.getMine);
router.put('/me', validateRequest(updateBusinessSettingsSchema), businessSettingsController.updateMine);
router.get('/:businessId', businessSettingsController.getByBusinessId);

export default router;
