import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createChatSessionSchema,
  createChatMessageSchema,
  endChatSessionSchema,
} from '../validators/chat.validator';
import { authenticate } from '../../middleware/auth.middleware';
import { optionalAuthenticate } from '../../middleware/optional-auth.middleware';

const router = Router();

// Soft auth: if the caller sends a valid Bearer, populate req.user so
// the controller can resolve businessId from it. Anonymous calls pass
// through unchanged.
router.use(optionalAuthenticate);

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

// Public routes (used by widget / anonymous visitors)
router.post(
  '/voice-transcribe',
  upload.single('file'),
  chatController.transcribeVoice,
);
router.post(
  '/session',
  validateRequest(createChatSessionSchema),
  chatController.createSession,
);

router.get(
  '/session/:sessionToken',
  chatController.getBySessionToken,
);

router.post(
  '/:chatSessionId/message',
  validateRequest(createChatMessageSchema),
  chatController.createMessage,
);

router.get(
  '/:chatSessionId/messages',
  chatController.getMessages,
);

router.post(
  '/:chatSessionId/end',
  validateRequest(endChatSessionSchema),
  chatController.endSession,
);

// Authenticated routes (business owner)
router.use(authenticate);

router.get('/business', chatController.getByBusinessId);
router.get('/visitor/:visitorId', chatController.getByVisitorId);
router.get('/active-sessions', chatController.getActiveSessions);

export default router;
