import { prisma } from '../../lib/prisma';
import { chatRepository } from '../repositories/chat.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import { config } from '../../config';
import logger from '../../utils/logger';
import {
  ChatSessionCreatedEvent,
  ChatSessionEndedEvent,
  MessageCreatedEvent,
} from '../events/chat.event';
import { chatListener } from '../listeners/chat.listener';
import { analyticsService } from '../../analytics/services/analytics.service';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { ChatSession, Message, Visitor } from '@prisma/client';

export class ChatService {
  // ---------------------------------------------------------------------------
  // Visitors
  // ---------------------------------------------------------------------------
  async createVisitor(data: {
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
  }): Promise<Visitor> {
    const existingVisitor = await chatRepository.findVisitorBySessionId(data.sessionId);
    if (existingVisitor) {
      return prisma.visitor.update({
        where: { id: existingVisitor.id },
        data: {
          lastVisit: new Date(),
          visitCount: { increment: 1 },
        },
      });
    }

    return chatRepository.createVisitor(data);
  }

  // ---------------------------------------------------------------------------
  // Chat sessions
  // ---------------------------------------------------------------------------
  async createChatSession(
    visitorId: string,
    businessId: string,
    widgetId?: string | null,
  ): Promise<ChatSession> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const sessionToken = uuidv4();

    const chatSession = await chatRepository.createChatSession({
      visitorId,
      businessId,
      sessionToken,
      widgetId: widgetId ?? null,
    });

    const event = new ChatSessionCreatedEvent(
      chatSession.id,
      visitorId,
      businessId,
      sessionToken,
    );
    await chatListener.onChatSessionCreated(event);

    return chatSession;
  }

  async getChatSessionById(id: string): Promise<ChatSession> {
    const session = await chatRepository.findById(id);
    if (!session) {
      throw new Error('Chat session not found');
    }
    return session;
  }

  async getChatSessionBySessionToken(sessionToken: string): Promise<ChatSession> {
    const session = await chatRepository.findBySessionToken(sessionToken);
    if (!session) {
      throw new Error('Chat session not found');
    }
    return session;
  }

  async getChatSessionsByBusinessId(businessId: string): Promise<ChatSession[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return chatRepository.findByBusinessId(businessId);
  }

  async getChatSessionsByVisitorId(visitorId: string): Promise<ChatSession[]> {
    return chatRepository.findByVisitorId(visitorId);
  }

  async getActiveChatSessionsByBusinessId(businessId: string): Promise<ChatSession[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return prisma.chatSession.findMany({
      where: { businessId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  async createMessage(
    chatSessionId: string,
    content: string,
    isFromUser: boolean,
    chatMode: 'text' | 'voice' = 'text',
    includeLiveWeb: boolean = false,
  ): Promise<Message> {
    const session = await chatRepository.findById(chatSessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    if (session.widgetId) {
      const widget = await prisma.widget.findUnique({
        where: { id: session.widgetId },
        select: { isEnabled: true },
      });
      if (widget && !widget.isEnabled) {
        throw new Error('This widget is currently disabled by the owner.');
      }
    }

    const message = await chatRepository.createMessage({
      chatSessionId,
      content,
      isFromUser,
    });

    const newCount = await chatRepository.getMessageCountByChatSessionId(chatSessionId);
    await chatRepository.updateMessageCount(chatSessionId, newCount);

    const event = new MessageCreatedEvent(
      message.id,
      chatSessionId,
      content,
      isFromUser,
    );
    await chatListener.onMessageCreated(event);

    // If the message is from the user, fire off a background task to get an AI
    // reply when it lands. Failures are logged, not surfaced.
    if (isFromUser) {
      setImmediate(() => {
        this.proxyToAiService(chatSessionId, content, chatMode, includeLiveWeb).catch((err) => {
          logger.error(
            { err, chatSessionId },
            'background AI proxy crashed',
          );
        });
      });
    }

    return message;
  }

  private async proxyToAiService(
    chatSessionId: string, 
    content: string, 
    chatMode: 'text' | 'voice' = 'text',
    includeLiveWeb: boolean = false,
  ): Promise<void> {
    try {
      const session = await chatRepository.findById(chatSessionId);
      if (!session) {
        logger.warn({ chatSessionId }, 'Cannot proxy chat to AI: session not found');
        return;
      }

      // Look up the business so we can pass the real business name +
      // URL through to ai-service. We pass business.name directly
      // (not a domain-derived label) so the advisor always answers
      // about the actual business the user created — regardless of
      // how many times they pasted different URLs into onboarding.
      const business = await businessRepository.findById(session.businessId);
      const companyName = business?.name && business.name !== 'My Business'
        ? business.name
        : (business?.websiteUrl ? safeDomainLabel(business.websiteUrl) : business?.name);
      const companyUrl = business?.websiteUrl ?? undefined;

      // Pull the last 3 messages from this SAME session (so the
      // advisor remembers the user's last 2-3 turns). Exclude the
      // message we just persisted above (it's `content`).
      const prior = await chatRepository.getMessagesByChatSessionId(chatSessionId);
      const recentMessages = prior
        .filter((m) => m.content !== content)
        .slice(-3)
        .map((m) => ({ role: m.isFromUser ? 'user' : 'assistant', content: m.content }));

      const aiServiceUrl = config.externalLlmServiceUrl === 'http://localhost:8000' && config.externalDocumentServiceUrl 
        ? config.externalDocumentServiceUrl 
        : config.externalLlmServiceUrl;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.externalApiKey) {
        headers['X-Api-Key'] = config.externalApiKey;
      }

      // Fetch widget details if the session is tied to a specific widget
      let widgetName: string | undefined;
      let widgetDescription: string | undefined;
      if (session.widgetId) {
        const widget = await prisma.widget.findUnique({ where: { id: session.widgetId } });
        if (widget) {
          widgetName = widget.title;
          widgetDescription = widget.description ?? undefined;
        }
      }

      // ai-service /v1/chat-sync expects {business_id, question, top_k,
      // score_threshold, include_live_web, company_name, company_url, widget_name, widget_description}
      // and returns {answer, citations, model, asked_at}.
      const aiResponse = await axios.post<{ answer?: string; response?: string }>(
        `${aiServiceUrl}/v1/chat-sync`,
        {
          business_id: session.businessId,
          widget_id: session.widgetId ?? undefined,
          widget_name: widgetName,
          widget_description: widgetDescription,
          question: content,
          top_k: 6,
          score_threshold: 0.3,
          include_live_web: includeLiveWeb,
          company_name: companyName,
          company_url: companyUrl,
          recent_messages: recentMessages,
          chat_mode: chatMode,
          source: session.widgetId ? 'widget' : 'onboarding',
        },
        { headers, timeout: 90_000 },
      );

      const botText = aiResponse.data?.answer ?? aiResponse.data?.response;
      if (botText) {
        await chatRepository.createMessage({
          chatSessionId,
          content: botText,
          isFromUser: false,
        });
        const newCount = await chatRepository.getMessageCountByChatSessionId(chatSessionId);
        await chatRepository.updateMessageCount(chatSessionId, newCount);
      }
    } catch (err: any) {
      logger.error({ err }, 'Failed to communicate with AI Service');
      
      let errorMessage = 'Sorry, the AI service encountered an error and could not generate a response.';
      const aiError = err.response?.data?.detail || err.response?.data?.error;
      
      if (err.response?.status === 404) {
        errorMessage = "I don't have any knowledge to answer that yet! Please crawl a website or upload some documents to my Knowledge Base first.";
      } else if (err.response?.status === 502) {
        errorMessage = `AI model failed to respond: ${aiError || 'Upstream LLM error'}`;
      } else if (aiError) {
        errorMessage = `AI service error: ${aiError}`;
      }

      try {
        await chatRepository.createMessage({
          chatSessionId,
          content: errorMessage,
          isFromUser: false,
        });
        const newCount = await chatRepository.getMessageCountByChatSessionId(chatSessionId);
        await chatRepository.updateMessageCount(chatSessionId, newCount);

        // Record failed response analytics
        const failSession = await chatRepository.findById(chatSessionId);
        if (failSession) {
          await analyticsService.createAnalytics({
            businessId: failSession.businessId,
            metricType: 'FAILED_RESPONSES',
            metricValue: 1,
          });
        }
      } catch (dbErr) {
        logger.error({ dbErr }, 'Failed to save error message or analytics');
      }
    }
  }

  async getMessagesByChatSessionId(chatSessionId: string): Promise<Message[]> {
    return chatRepository.getMessagesByChatSessionId(chatSessionId);
  }

  // ---------------------------------------------------------------------------
  // End session
  // ---------------------------------------------------------------------------
  async endChatSession(
    chatSessionId: string,
    satisfactionScore?: number,
    feedback?: string,
  ): Promise<ChatSession> {
    const session = await chatRepository.findById(chatSessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const ended = await chatRepository.endChatSession(
      chatSessionId,
      satisfactionScore,
      feedback,
    );

    const event = new ChatSessionEndedEvent(
      chatSessionId,
      satisfactionScore ?? null,
      feedback ?? null,
    );
    await chatListener.onChatSessionEnded(event);

    return ended;
  }
}

// Duplicated from website.controller.ts so chat.service doesn't grow
// a cross-module import. Returns "Amazon" for "https://amazon.in/path",
// "My Business" if the URL is unparseable.
function safeDomainLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const root = host.split('.')[0] || host;
    return root.charAt(0).toUpperCase() + root.slice(1);
  } catch {
    return 'My Business';
  }
}

export const chatService = new ChatService();
