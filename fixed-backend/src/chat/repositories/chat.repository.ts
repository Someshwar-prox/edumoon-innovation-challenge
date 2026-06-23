import { prisma } from '../../lib/prisma';
import { ChatSession, Message, Visitor } from '@prisma/client';

// Chat repository
export class ChatRepository {
  // Find chat session by ID
  async findById(id: string): Promise<ChatSession | null> {
    return prisma.chatSession.findUnique({
      where: { id }
    });
  }

  // Find chat session by session token
  async findBySessionToken(sessionToken: string): Promise<ChatSession | null> {
    return prisma.chatSession.findUnique({
      where: { sessionToken }
    });
  }

  // Find chat sessions by business ID
  async findByBusinessId(businessId: string): Promise<ChatSession[]> {
    return prisma.chatSession.findMany({
      where: { businessId },
      orderBy: { startedAt: 'desc' }
    });
  }

  // Find chat sessions by visitor ID
  async findByVisitorId(visitorId: string): Promise<ChatSession[]> {
    return prisma.chatSession.findMany({
      where: { visitorId },
      orderBy: { startedAt: 'desc' }
    });
  }

  // Create visitor
  async createVisitor(data: {
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
  }): Promise<Visitor> {
    return prisma.visitor.create({
      data: {
        sessionId: data.sessionId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        country: data.country,
        city: data.city
      }
    });
  }

  // Find visitor by session ID
  async findVisitorBySessionId(sessionId: string): Promise<Visitor | null> {
    return prisma.visitor.findUnique({
      where: { sessionId }
    });
  }

  // Create chat session
  async createChatSession(data: {
    visitorId: string;
    businessId: string;
    sessionToken: string;
    widgetId?: string | null;
  }): Promise<ChatSession> {
    return prisma.chatSession.create({
      data: {
        visitorId: data.visitorId,
        businessId: data.businessId,
        sessionToken: data.sessionToken,
        widgetId: data.widgetId ?? null,
      }
    });
  }

  async deleteByBusinessId(businessId: string): Promise<number> {
    const res = await prisma.chatSession.deleteMany({ where: { businessId } });
    return res.count;
  }

  // Update chat session (end session, update message count, etc.)
  async updateChatSession(id: string, data: Partial<Omit<ChatSession, 'id' | 'visitorId' | 'businessId' | 'startedAt'>>): Promise<ChatSession> {
    return prisma.chatSession.update({
      where: { id },
      data
    });
  }

  // Create message
  async createMessage(data: {
    chatSessionId: string;
    content: string;
    isFromUser: boolean;
  }): Promise<Message> {
    return prisma.message.create({
      data: {
        chatSessionId: data.chatSessionId,
        content: data.content,
        isFromUser: data.isFromUser
      }
    });
  }

  // Get messages for chat session
  async getMessagesByChatSessionId(chatSessionId: string): Promise<Message[]> {
    return prisma.message.findMany({
      where: { chatSessionId },
      orderBy: { createdAt: 'asc' }
    });
  }

  // Get message count for chat session
  async getMessageCountByChatSessionId(chatSessionId: string): Promise<number> {
    return prisma.message.count({
      where: { chatSessionId }
    });
  }

  // Update message count for chat session
  async updateMessageCount(chatSessionId: string, count: number): Promise<ChatSession> {
    return prisma.chatSession.update({
      where: { id: chatSessionId },
      data: { messageCount: count }
    });
  }

  // End chat session
  async endChatSession(id: string, satisfactionScore?: number, feedback?: string): Promise<ChatSession> {
    return prisma.chatSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        satisfactionScore,
        feedback
      }
    });
  }
}

// Export singleton instance
export const chatRepository = new ChatRepository();