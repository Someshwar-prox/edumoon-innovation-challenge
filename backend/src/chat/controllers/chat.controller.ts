import { Request, Response, NextFunction } from 'express';
import FormData from 'form-data';
import axios from 'axios';
import {
  createChatSessionSchema,
  createChatMessageSchema,
  endChatSessionSchema,
} from '../validators/chat.validator';
import { chatService } from '../services/chat.service';
import { businessRepository } from '../../business/repositories/business.repository';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

export class ChatController {
  // POST /api/chat/session — create chat session (widget / business owner)
  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info({ user: req.user?.id, body: req.body }, 'chat session start');
      const data = createChatSessionSchema.parse(req.body);

      // Resolve business from (in order): explicit body.businessId →
// widgetId's business → authenticated user's default business.
// The session endpoint is public (the /<slug> embeddable route hits it
// anonymously, sending only widgetId), so we resolve from any of
// those before treating it as a misuse.
      let businessId = data.businessId;
      if (!businessId && data.widgetId) {
        try {
          const widget = await prisma.widget.findUnique({
            where: { id: data.widgetId },
            select: { businessId: true },
          });
          if (widget) businessId = widget.businessId;
        } catch {
          // ignore — fall through to the user/businessId check below
        }
      }
      if (!businessId) {
        const userId = req.user?.id;
        if (userId) {
          const business = await businessRepository.findByUserId(userId);
          if (business) businessId = business.id;
        }
        if (!businessId) {
          return res.status(400).json({
            error: 'businessId or widgetId required (and no authenticated user to resolve from)',
          });
        }
      }

      const rawVisitorId = data.visitorId ?? `temp-visitor-${Date.now()}`;
      // Ensure a Visitor row exists for this sessionId so the FK to
      // ChatSession.visitorId is satisfied.
      const visitor = await chatService.createVisitor({ sessionId: rawVisitorId });

      const chatSession = await chatService.createChatSession(
        visitor.id,
        businessId,
        data.widgetId ?? null,
      );

      return res.status(201).json({
        message: 'Chat session created successfully',
        chatSession: {
          id: chatSession.id,
          sessionToken: chatSession.sessionToken,
          startedAt: chatSession.startedAt,
        },
      });
    } catch (error) {
      logger.error('Create chat session failed', error);
      return next(error);
    }
  }

  // GET /api/chat/session/:sessionToken — lookup by widget token
  async getBySessionToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionToken } = req.params;
      const chatSession = await chatService.getChatSessionBySessionToken(sessionToken);
      return res.status(200).json({ chatSession });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/business — list sessions for the authenticated user's business
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const chatSessions = await chatService.getChatSessionsByBusinessId(business.id);
      return res.status(200).json({ chatSessions });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/visitor/:visitorId — list sessions for a given visitor
  async getByVisitorId(req: Request, res: Response, next: NextFunction) {
    try {
      const { visitorId } = req.params;
      const chatSessions = await chatService.getChatSessionsByVisitorId(visitorId);
      return res.status(200).json({ chatSessions });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/chat/:chatSessionId/message
  async createMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { chatSessionId } = req.params;
      const data = createChatMessageSchema.parse(req.body);
      const message = await chatService.createMessage(
        chatSessionId,
        data.content,
        data.isFromUser,
        data.chatMode,
      );
      return res.status(201).json({
        message: 'Message created successfully',
        result: message,
        chatSessionId,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/:chatSessionId/messages
  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const { chatSessionId } = req.params;
      const messages = await chatService.getMessagesByChatSessionId(chatSessionId);
      return res.status(200).json({ messages });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/chat/:chatSessionId/end
  async endSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { chatSessionId } = req.params;
      const data = endChatSessionSchema.parse(req.body);
      const chatSession = await chatService.endChatSession(
        chatSessionId,
        data.satisfactionScore,
        data.feedback,
      );
      return res.status(200).json({
        message: 'Chat session ended successfully',
        chatSession,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/chat/active-sessions — sessions with no endedAt for the auth'd business
  async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const activeSessions = await chatService.getActiveChatSessionsByBusinessId(business.id);
      return res.status(200).json({ activeSessions });
    } catch (error) {
      return next(error);
    }
  }
  // POST /api/chat/voice-transcribe
  async transcribeVoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Audio file required' });
      }
      const language = req.body.language || 'en';
      
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname || 'audio.webm',
        contentType: req.file.mimetype || 'audio/webm',
      });
      formData.append('language', language);

      const aiBaseUrl = config.externalDocumentServiceUrl || 'http://127.0.0.1:8000';
      const aiServiceUrl = `${aiBaseUrl}/v1/speech-to-text`;
      const response = await axios.post(aiServiceUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Length': formData.getLengthSync()
        },
      });

      return res.status(200).json(response.data);
    } catch (error: any) {
      const details = error.response?.data || error.message || error;
      logger.error('Voice transcription failed', details);
      return res.status(500).json({ error: `STT Error: ${JSON.stringify(details)}` });
    }
  }

  // POST /api/chat/tts
  async textToSpeech(req: Request, res: Response, next: NextFunction) {
    try {
      const text = req.body.text;
      if (!text) {
        return res.status(400).json({ error: 'Text required' });
      }
      
      const aiBaseUrl = config.externalDocumentServiceUrl || 'http://127.0.0.1:8000';
      const aiServiceUrl = `${aiBaseUrl}/v1/text-to-speech`;
      const response = await axios.post(aiServiceUrl, { text }, {
        responseType: 'stream',
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      response.data.pipe(res);
      return;
    } catch (error: any) {
      const details = error.response?.data || error.message || error;
      logger.error('TTS failed', details);
      return res.status(500).json({ error: `TTS Error: ${JSON.stringify(details)}` });
    }
  }
}

export const chatController = new ChatController();
