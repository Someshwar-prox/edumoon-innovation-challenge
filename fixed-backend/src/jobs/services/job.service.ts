import { Job, JobStatus, Prisma } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import logger from '../../utils/logger';
import {
  JobCompletedEvent,
  JobCreatedEvent,
  JobDeletedEvent,
  JobFailedEvent,
  JobStartedEvent,
  JobUpdatedEvent,
} from '../events/job.event';
import { jobListener } from '../listeners/job.listener';

export interface CreateJobInput {
  name: string;
  type: string;
  payload?: Record<string, unknown>;
  scheduledAt?: Date;
  businessId?: string;
}

export interface UpdateJobInput {
  name?: string;
  type?: string;
  payload?: Record<string, unknown>;
  scheduledAt?: Date | null;
  status?: JobStatus;
}

export class JobService {
  // ---------------------------------------------------------------------------
  // Create / read
  // ---------------------------------------------------------------------------
  async createJob(data: CreateJobInput): Promise<Job> {
    if (data.businessId) {
      const business = await businessRepository.findById(data.businessId);
      if (!business) {
        throw new Error('Business not found');
      }
    }
    const job = await jobRepository.createJob({
      name: data.name,
      type: data.type,
      payload: (data.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      scheduledAt: data.scheduledAt ?? null,
      businessId: data.businessId ?? null,
    });

    await jobListener.onJobCreated(
      new JobCreatedEvent(job.id, job.name, job.type, job.businessId),
    );
    return job;
  }

  async getJobById(id: string): Promise<Job> {
    const job = await jobRepository.findById(id);
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  }

  async getJobsByBusinessId(businessId: string): Promise<Job[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return jobRepository.findByBusinessId(businessId);
  }

  async getJobsByType(type: string): Promise<Job[]> {
    return jobRepository.findByType(type);
  }

  async getJobsByStatus(status: JobStatus): Promise<Job[]> {
    return jobRepository.findByStatus(status);
  }

  async getPendingJobs(limit = 10): Promise<Job[]> {
    return jobRepository.findPendingJobs(limit);
  }

  // ---------------------------------------------------------------------------
  // Mutate
  // ---------------------------------------------------------------------------
  async updateJob(id: string, data: UpdateJobInput): Promise<Job> {
    const existing = await jobRepository.findById(id);
    if (!existing) {
      throw new Error('Job not found');
    }
    const job = await jobRepository.updateJob(id, {
      name: data.name,
      type: data.type,
      payload: data.payload ? (data.payload as Prisma.InputJsonValue) : undefined,
      scheduledAt: data.scheduledAt,
      status: data.status,
    });

    await jobListener.onJobUpdated(
      new JobUpdatedEvent(job.id, {
        name: data.name,
        type: data.type,
        payload: data.payload,
        scheduledAt: data.scheduledAt ?? undefined,
        status: data.status,
      }),
    );
    return job;
  }

  async deleteJob(id: string): Promise<Job> {
    const existing = await jobRepository.findById(id);
    if (!existing) {
      throw new Error('Job not found');
    }
    const job = await jobRepository.deleteJob(id);
    await jobListener.onJobDeleted(new JobDeletedEvent(job.id));
    return job;
  }

  async startJob(id: string): Promise<Job> {
    const existing = await jobRepository.findById(id);
    if (!existing) {
      throw new Error('Job not found');
    }
    const job = await jobRepository.startJob(id);
    await jobListener.onJobStarted(new JobStartedEvent(job.id));
    return job;
  }

  async completeJob(id: string): Promise<Job> {
    const existing = await jobRepository.findById(id);
    if (!existing) {
      throw new Error('Job not found');
    }
    const job = await jobRepository.completeJob(id);
    await jobListener.onJobCompleted(new JobCompletedEvent(job.id));
    return job;
  }

  async failJob(id: string, errorMessage: string): Promise<Job> {
    const existing = await jobRepository.findById(id);
    if (!existing) {
      throw new Error('Job not found');
    }
    const job = await jobRepository.failJob(id, errorMessage);
    await jobListener.onJobFailed(new JobFailedEvent(job.id, errorMessage));
    return job;
  }

  // ---------------------------------------------------------------------------
  // Counters
  // ---------------------------------------------------------------------------
  async getJobCount(): Promise<number> {
    return jobRepository.getCount();
  }

  async getJobCountByBusinessId(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return jobRepository.getCountByBusinessId(businessId);
  }

  async getJobCountByType(type: string): Promise<number> {
    return jobRepository.getCountByType(type);
  }

  async getJobCountByStatus(status: JobStatus): Promise<number> {
    return jobRepository.getCountByStatus(status);
  }

  // ---------------------------------------------------------------------------
  // Run a job inline (used by worker entry points / tests)
  // ---------------------------------------------------------------------------
  async runInline<T>(id: string, runner: (job: Job) => Promise<T>): Promise<T> {
    try {
      await this.startJob(id);
      const result = await runner(await this.getJobById(id));
      await this.completeJob(id);
      logger.info({ jobId: id }, 'Job completed inline');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.failJob(id, message);
      throw err;
    }
  }
}

export const jobService = new JobService();
