import { prisma } from '../../lib/prisma';
import { SyncJob } from '@prisma/client';

export class SyncRepository {
  async findById(id: string): Promise<SyncJob | null> {
    return prisma.syncJob.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<SyncJob[]> {
    return prisma.syncJob.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBusinessIdAndStatus(
    businessId: string,
    status: string,
  ): Promise<SyncJob[]> {
    return prisma.syncJob.findMany({
      where: { businessId, status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestByBusinessIdAndType(
    businessId: string,
    type: string,
  ): Promise<SyncJob | null> {
    return prisma.syncJob.findFirst({
      where: { businessId, type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSyncJob(data: {
    businessId: string;
    type: string;
    startedAt?: Date | null;
    completedAt?: Date | null;
    errorMessage?: string | null;
    pagesProcessed?: number;
    documentsProcessed?: number;
  }): Promise<SyncJob> {
    return prisma.syncJob.create({
      data: {
        businessId: data.businessId,
        type: data.type,
        startedAt: data.startedAt ?? null,
        completedAt: data.completedAt ?? null,
        errorMessage: data.errorMessage ?? null,
        pagesProcessed: data.pagesProcessed ?? 0,
        documentsProcessed: data.documentsProcessed ?? 0,
      },
    });
  }

  async updateSyncJob(
    id: string,
    data: Partial<{
      status: string;
      startedAt: Date | null;
      completedAt: Date | null;
      errorMessage: string | null;
      pagesProcessed: number;
      documentsProcessed: number;
      type: string;
    }>,
  ): Promise<SyncJob> {
    return prisma.syncJob.update({ where: { id }, data });
  }

  async deleteSyncJob(id: string): Promise<SyncJob> {
    return prisma.syncJob.delete({ where: { id } });
  }

  async startSyncJob(id: string): Promise<SyncJob> {
    return prisma.syncJob.update({
      where: { id },
      data: { status: 'in_progress', startedAt: new Date() },
    });
  }

  async completeSyncJob(
    id: string,
    data: { pagesProcessed?: number; documentsProcessed?: number },
  ): Promise<SyncJob> {
    return prisma.syncJob.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        pagesProcessed: data.pagesProcessed ?? 0,
        documentsProcessed: data.documentsProcessed ?? 0,
      },
    });
  }

  async failSyncJob(id: string, errorMessage: string): Promise<SyncJob> {
    return prisma.syncJob.update({
      where: { id },
      data: { status: 'failed', completedAt: new Date(), errorMessage },
    });
  }

  async getCountByBusinessId(businessId: string): Promise<number> {
    return prisma.syncJob.count({ where: { businessId } });
  }
}

export const syncRepository = new SyncRepository();
