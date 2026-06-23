import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public liveness probe
router.get('/', healthController.check);

// Authenticated views of historical data (currently empty)
router.get('/history', authenticate, healthController.history);
router.get('/latest', authenticate, healthController.latest);

export default router;
