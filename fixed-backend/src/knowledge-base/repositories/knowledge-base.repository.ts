import { prisma } from '../../lib/prisma';
import { KnowledgeBase } from '@prisma/client';

export class KnowledgeBaseRepository {
  async findById(id: string): Promise<KnowledgeBase | null> {
    return prisma.knowledgeBase.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<KnowledgeBase | null> {
    return prisma.knowledgeBase.findUnique({ where: { businessId } });
  }

  async createKnowledgeBase(data: {
    businessId: string;
    name?: string;
    description?: string;
  }): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.create({
      data: {
        businessId: data.businessId,
        name: data.name ?? 'Default Knowledge Base',
        description: data.description ?? null,
      },
    });
  }

  async updateKnowledgeBase(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      documentCount: number;
      pageCount: number;
      chunkCount: number;
      isReady: boolean;
    }>,
  ): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({ where: { id }, data });
  }

  async deleteKnowledgeBase(id: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.delete({ where: { id } });
  }

  async incrementDocumentCount(id: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({
      where: { id },
      data: { documentCount: { increment: 1 } },
    });
  }

  async decrementDocumentCount(id: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({
      where: { id },
      data: { documentCount: { decrement: 1 } },
    });
  }

  async incrementPageCount(id: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({
      where: { id },
      data: { pageCount: { increment: 1 } },
    });
  }

  async decrementPageCount(id: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({
      where: { id },
      data: { pageCount: { decrement: 1 } },
    });
  }

  async setReady(id: string, isReady: boolean): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({ where: { id }, data: { isReady } });
  }
}

export const knowledgeBaseRepository = new KnowledgeBaseRepository();
