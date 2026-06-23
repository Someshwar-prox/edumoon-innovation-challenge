import logger from '../../utils/logger';
import { ChatSession } from '@prisma/client';
import {
  ChatSessionCreatedEvent,
  ChatSessionEndedEvent,
  MessageCreatedEvent,
  VisitorCreatedEvent,
} from '../events/chat.event';

export class ChatListener {
  async onChatSessionCreated(event: ChatSessionCreatedEvent): Promise<void> {
    try {
      logger.info(
        {
          chatSessionId: event.chatSessionId,
          visitorId: event.visitorId,
          businessId: event.businessId,
        },
        'Chat session created',
      );
      // TODO: notify business owner of new chat request (push / email)
      // TODO: seed chatbot context window for the session
    } catch (err) {
      logger.error('Error in onChatSessionCreated listener', err);
    }
  }

  async onChatSessionEnded(event: ChatSessionEndedEvent): Promise<void> {
    try {
      logger.info(
        {
          chatSessionId: event.chatSessionId,
          satisfactionScore: event.satisfactionScore,
        },
        'Chat session ended',
      );
      // TODO: trigger satisfaction-based follow-ups
      // TODO: emit analytics event
    } catch (err) {
      logger.error('Error in onChatSessionEnded listener', err);
    }
  }

  async onMessageCreated(event: MessageCreatedEvent): Promise<void> {
    try {
      logger.info(
        {
          messageId: event.messageId,
          chatSessionId: event.chatSessionId,
          isFromUser: event.isFromUser,
        },
        'Message created',
      );
    } catch (err) {
      logger.error('Error in onMessageCreated listener', err);
    }
  }

  async onVisitorCreated(event: VisitorCreatedEvent): Promise<void> {
    try {
      logger.info(
        { visitorId: event.visitorId, sessionId: event.sessionId },
        'Visitor created',
      );
    } catch (err) {
      logger.error('Error in onVisitorCreated listener', err);
    }
  }
}

export const chatListener = new ChatListener();

// Re-export helper that exposes a domain-level default for getActiveSessions lookups.
export function isActiveSession(session: ChatSession): boolean {
  return session.endedAt === null;
}
