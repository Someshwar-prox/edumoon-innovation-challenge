import { prisma } from '../../lib/prisma';
import { Job, JobStatus, Prisma } from '@prisma/client';

export class JobRepository {
  async findById(id: string): Promise<Job | null> {
    return prisma.job.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<Job[]> {
    return prisma.job.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByType(type: string): Promise<Job[]> {
    return prisma.job.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStatus(status: JobStatus): Promise<Job[]> {
    return prisma.job.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingJobs(limit = 10): Promise<Job[]> {
    return prisma.job.findMany({
      where: {
        status: JobStatus.PENDING,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async createJob(data: {
    name: string;
    type: string;
    payload?: Prisma.InputJsonValue;
    scheduledAt?: Date | null;
    businessId?: string | null;
  }): Promise<Job> {
    return prisma.job.create({
      data: {
        name: data.name,
        type: data.type,
        payload: data.payload ?? Prisma.JsonNull,
        scheduledAt: data.scheduledAt ?? null,
        businessId: data.businessId ?? null,
      },
    });
  }

  async updateJob(
    id: string,
    data: Partial<{
      name: string;
      type: string;
      payload: Prisma.InputJsonValue;
      scheduledAt: Date | null;
      businessId: string | null;
      status: JobStatus;
      startedAt: Date | null;
      completedAt: Date | null;
      lastError: string | null;
    }>,
  ): Promise<Job> {
    return prisma.job.update({ where: { id }, data });
  }

  async deleteJob(id: string): Promise<Job> {
    // Jobs don't have soft-delete; hard delete is OK here.
    return prisma.job.delete({ where: { id } });
  }

  async startJob(id: string): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.PROCESSING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async completeJob(id: string): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  async failJob(id: string, errorMessage: string): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        lastError: errorMessage,
      },
    });
  }

  async getCount(): Promise<number> {
    return prisma.job.count();
  }

  async getCountByBusinessId(businessId: string): Promise<number> {
    return prisma.job.count({ where: { businessId } });
  }

  async getCountByType(type: string): Promise<number> {
    return prisma.job.count({ where: { type } });
  }

  async getCountByStatus(status: JobStatus): Promise<number> {
    return prisma.job.count({ where: { status } });
  }
}

export const jobRepository = new JobRepository();
