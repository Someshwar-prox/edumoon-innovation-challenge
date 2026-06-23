import { prisma } from '../../lib/prisma';
import { KnowledgeBase } from '@prisma/client';
import { knowledgeBaseRepository } from '../repositories/knowledge-base.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import { documentRepository } from '../../documents/repositories/document.repository';
import { websiteRepository } from '../../website/repositories/website.repository';
import {
  KnowledgeBaseCreatedEvent,
  KnowledgeBaseDeletedEvent,
  KnowledgeBaseUpdatedEvent,
} from '../events/knowledge-base.event';
import { knowledgeBaseListener } from '../listeners/knowledge-base.listener';

export interface KnowledgeBaseStats {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  pageCount: number;
  chunkCount: number;
  isReady: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeBaseService {
  async getKnowledgeBaseByBusinessId(businessId: string): Promise<KnowledgeBase> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const existing = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (existing) return existing;

    // Lazy-create a default knowledge base for this business
    return knowledgeBaseRepository.createKnowledgeBase({ businessId });
  }

  async createKnowledgeBase(
    businessId: string,
    data: { name?: string; description?: string },
  ): Promise<KnowledgeBase> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const existing = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (existing) throw new Error('Knowledge base already exists for this business');

    const kb = await knowledgeBaseRepository.createKnowledgeBase({
      businessId,
      name: data.name,
      description: data.description,
    });
    await knowledgeBaseListener.onKnowledgeBaseCreated(
      new KnowledgeBaseCreatedEvent(kb.id, businessId),
    );
    return kb;
  }

  async updateKnowledgeBase(
    businessId: string,
    data: { name?: string; description?: string | null },
  ): Promise<KnowledgeBase> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');

    const updated = await knowledgeBaseRepository.updateKnowledgeBase(kb.id, {
      name: data.name,
      description: data.description ?? undefined,
    });
    await knowledgeBaseListener.onKnowledgeBaseUpdated(
      new KnowledgeBaseUpdatedEvent(updated.id, {
        name: data.name,
        description: data.description ?? undefined,
      }),
    );
    return updated;
  }

  async deleteKnowledgeBase(businessId: string): Promise<KnowledgeBase> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');
    const deleted = await knowledgeBaseRepository.deleteKnowledgeBase(kb.id);
    await knowledgeBaseListener.onKnowledgeBaseDeleted(
      new KnowledgeBaseDeletedEvent(deleted.id),
    );
    return deleted;
  }

  async addDocumentToKnowledgeBase(businessId: string): Promise<KnowledgeBase> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');
    const updated = await knowledgeBaseRepository.incrementDocumentCount(kb.id);
    await knowledgeBaseListener.onKnowledgeBaseUpdated(
      new KnowledgeBaseUpdatedEvent(updated.id, { documentCount: updated.documentCount }),
    );
    return updated;
  }

  async removeDocumentFromKnowledgeBase(businessId: string): Promise<KnowledgeBase> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');
    const updated = await knowledgeBaseRepository.decrementDocumentCount(kb.id);
    await knowledgeBaseListener.onKnowledgeBaseUpdated(
      new KnowledgeBaseUpdatedEvent(updated.id, { documentCount: updated.documentCount }),
    );
    return updated;
  }

  async addPageToKnowledgeBase(businessId: string): Promise<KnowledgeBase> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');
    const updated = await knowledgeBaseRepository.incrementPageCount(kb.id);
    await knowledgeBaseListener.onKnowledgeBaseUpdated(
      new KnowledgeBaseUpdatedEvent(updated.id, { pageCount: updated.pageCount }),
    );
    return updated;
  }

  async removePageFromKnowledgeBase(businessId: string): Promise<KnowledgeBase> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');
    const updated = await knowledgeBaseRepository.decrementPageCount(kb.id);
    await knowledgeBaseListener.onKnowledgeBaseUpdated(
      new KnowledgeBaseUpdatedEvent(updated.id, { pageCount: updated.pageCount }),
    );
    return updated;
  }

  async setKnowledgeBaseReady(
    businessId: string,
    isReady: boolean,
  ): Promise<KnowledgeBase> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');
    const updated = await knowledgeBaseRepository.setReady(kb.id, isReady);
    await knowledgeBaseListener.onKnowledgeBaseUpdated(
      new KnowledgeBaseUpdatedEvent(updated.id, { isReady }),
    );
    return updated;
  }

  async getKnowledgeBaseStats(businessId: string): Promise<KnowledgeBaseStats> {
    const kb = await knowledgeBaseRepository.findByBusinessId(businessId);
    if (!kb) throw new Error('Knowledge base not found for business');

    const documentCount = await documentRepository.countByBusinessId(businessId);
    const website = await websiteRepository.findByBusinessId(businessId);
    const pageCount = website
      ? await prisma.websitePage.count({ where: { websiteId: website.id } })
      : 0;

    return {
      id: kb.id,
      name: kb.name,
      description: kb.description,
      documentCount,
      pageCount,
      chunkCount: kb.chunkCount,
      isReady: kb.isReady,
      createdAt: kb.createdAt,
      updatedAt: kb.updatedAt,
    };
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
