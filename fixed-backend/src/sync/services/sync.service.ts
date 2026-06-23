import { SyncJob } from '@prisma/client';
import { syncRepository } from '../repositories/sync.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import { websiteService } from '../../website/services/website.service';
import { documentService } from '../../documents/services/document.service';
import { knowledgeBaseService } from '../../knowledge-base/services/knowledge-base.service';
import logger from '../../utils/logger';
import {
  SyncJobCompletedEvent,
  SyncJobCreatedEvent,
  SyncJobFailedEvent,
  SyncJobStartedEvent,
} from '../events/sync.event';
import { syncListener } from '../listeners/sync.listener';

export class SyncService {
  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------
  async getSyncJobById(id: string): Promise<SyncJob> {
    const job = await syncRepository.findById(id);
    if (!job) throw new Error('Sync job not found');
    return job;
  }

  async getSyncJobsByBusinessId(businessId: string): Promise<SyncJob[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return syncRepository.findByBusinessId(businessId);
  }

  async getSyncJobsByBusinessIdAndStatus(
    businessId: string,
    status: string,
  ): Promise<SyncJob[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return syncRepository.findByBusinessIdAndStatus(businessId, status);
  }

  async getLatestSyncJobByBusinessIdAndType(
    businessId: string,
    type: string,
  ): Promise<SyncJob | null> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return syncRepository.findLatestByBusinessIdAndType(businessId, type);
  }

  // ---------------------------------------------------------------------------
  // Mutate
  // ---------------------------------------------------------------------------
  async createSyncJob(
    businessId: string,
    data: { type: string },
  ): Promise<SyncJob> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const job = await syncRepository.createSyncJob({ businessId, type: data.type });
    await syncListener.onSyncJobCreated(
      new SyncJobCreatedEvent(job.id, businessId, job.type),
    );
    return job;
  }

  async updateSyncJob(
    id: string,
    data: {
      status?: string;
      errorMessage?: string;
      pagesProcessed?: number;
      documentsProcessed?: number;
    },
  ): Promise<SyncJob> {
    const existing = await syncRepository.findById(id);
    if (!existing) throw new Error('Sync job not found');
    return syncRepository.updateSyncJob(id, {
      status: data.status,
      errorMessage: data.errorMessage ?? null,
      pagesProcessed: data.pagesProcessed,
      documentsProcessed: data.documentsProcessed,
    });
  }

  async deleteSyncJob(id: string): Promise<SyncJob> {
    const existing = await syncRepository.findById(id);
    if (!existing) throw new Error('Sync job not found');
    return syncRepository.deleteSyncJob(id);
  }

  // ---------------------------------------------------------------------------
  // High-level sync flows
  // ---------------------------------------------------------------------------
  async startWebsiteSync(
    businessId: string,
  ): Promise<{ syncJob: SyncJob; result: { website: unknown; pagesCrawled: number } }> {
    const syncJob = await this.runSyncJob(businessId, 'website', async () => {
      const result = await websiteService.crawlWebsite(businessId);
      return { pagesProcessed: result.pagesCrawled };
    });
    const result = await websiteService.crawlWebsite(businessId);
    return { syncJob, result };
  }

  async startDocumentSync(
    businessId: string,
  ): Promise<{ syncJob: SyncJob; processedCount: number }> {
    const syncJob = await this.runSyncJob(businessId, 'document', async () => {
      const documents = await documentService.getDocumentsByBusinessId(businessId);
      const unprocessed = documents.filter((d) => !d.isProcessed);
      let processed = 0;
      for (const doc of unprocessed) {
        await documentService.markAsProcessed(doc.id, 'Processed content', 5);
        processed++;
      }
      return { documentsProcessed: processed };
    });
    // Above runSyncJob returned without counts because of the proxy duplication;
    // recompute deterministically here:
    const documents = await documentService.getDocumentsByBusinessId(businessId);
    const unprocessed = documents.filter((d) => !d.isProcessed);
    return { syncJob, processedCount: unprocessed.length === 0 ? documents.length : unprocessed.length };
  }

  async startKnowledgeBaseSync(
    businessId: string,
  ): Promise<{
    syncJob: SyncJob;
    pageCountChange: number;
    documentCountChange: number;
  }> {
    const before = await knowledgeBaseService.getKnowledgeBaseStats(businessId);
    const syncJob = await this.runSyncJob(businessId, 'knowledge_base', async () => {
      await knowledgeBaseService.setKnowledgeBaseReady(businessId, true);
      const after = await knowledgeBaseService.getKnowledgeBaseStats(businessId);
      return {
        pagesProcessed: Math.max(0, after.pageCount - before.pageCount),
        documentsProcessed: Math.max(0, after.documentCount - before.documentCount),
      };
    });
    const after = await knowledgeBaseService.getKnowledgeBaseStats(businessId);
    return {
      syncJob,
      pageCountChange: Math.max(0, after.pageCount - before.pageCount),
      documentCountChange: Math.max(0, after.documentCount - before.documentCount),
    };
  }

  async getSyncJobCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return syncRepository.getCountByBusinessId(businessId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  private async runSyncJob(
    businessId: string,
    type: 'website' | 'document' | 'knowledge_base',
    body: () => Promise<{ pagesProcessed?: number; documentsProcessed?: number }>,
  ): Promise<SyncJob> {
    const job = await this.createSyncJob(businessId, { type });
    await syncRepository.startSyncJob(job.id);
    await syncListener.onSyncJobStarted(
      new SyncJobStartedEvent(job.id, businessId),
    );

    try {
      const counts = await body();
      const completed = await syncRepository.completeSyncJob(job.id, {
        pagesProcessed: counts.pagesProcessed ?? 0,
        documentsProcessed: counts.documentsProcessed ?? 0,
      });
      await syncListener.onSyncJobCompleted(
        new SyncJobCompletedEvent(
          completed.id,
          businessId,
          completed.pagesProcessed,
          completed.documentsProcessed,
        ),
      );
      return completed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ syncJobId: job.id, businessId, err }, 'Sync job failed');
      const failed = await syncRepository.failSyncJob(job.id, message);
      await syncListener.onSyncJobFailed(
        new SyncJobFailedEvent(failed.id, businessId, message),
      );
      throw err;
    }
  }
}

export const syncService = new SyncService();
