import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { businessRepository } from '../../business/repositories/business.repository';
import { createJobSchema, updateJobSchema, failJobSchema } from '../validators/job.validator';
import { jobService } from '../services/job.service';
import logger from '../../utils/logger';

export class JobController {
  // POST /api/jobs
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const body = createJobSchema.parse(req.body);

      // Default businessId to the caller's business unless they are admin.
      let businessId = body.businessId;
      if (!businessId) {
        const business = await businessRepository.findByUserId(userId);
        businessId = business?.id;
      }

      const job = await jobService.createJob({ ...body, businessId });
      return res.status(201).json({ message: 'Job created successfully', job });
    } catch (error) {
      logger.error('Create job failed', error);
      return next(error);
    }
  }

  // GET /api/jobs/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const job = await jobService.getJobById(id);
      return res.status(200).json({ job });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/business — list jobs for the auth'd user's business
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
      const jobs = await jobService.getJobsByBusinessId(business.id);
      return res.status(200).json({ jobs });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/type/:type
  async getByType(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const jobs = await jobService.getJobsByType(type);
      return res.status(200).json({ jobs });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/status/:status
  async getByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.params;
      const jobs = await jobService.getJobsByStatus(status as never);
      return res.status(200).json({ jobs });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/pending?limit=10
  async getPending(req: Request, res: Response, next: NextFunction) {
    try {
      const limitRaw = Number(req.query.limit ?? 10);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10;
      const jobs = await jobService.getPendingJobs(limit);
      return res.status(200).json({ jobs });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/jobs/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = updateJobSchema.parse(req.body);
      const job = await jobService.updateJob(id, body);
      return res.status(200).json({ message: 'Job updated successfully', job });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/jobs/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await jobService.deleteJob(id);
      return res.status(200).json({ message: 'Job deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/jobs/:id/start
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const job = await jobService.startJob(id);
      return res.status(200).json({ message: 'Job started successfully', job });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/jobs/:id/complete
  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const job = await jobService.completeJob(id);
      return res.status(200).json({ message: 'Job completed successfully', job });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/jobs/:id/fail
  async fail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = failJobSchema.parse(req.body);
      const job = await jobService.failJob(id, body.errorMessage);
      return res.status(200).json({ message: 'Job marked as failed', job });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/count — admin
  async getCount(_req: Request, res: Response, next: NextFunction) {
    try {
      const count = await jobService.getJobCount();
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/business/count
  async getCountByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const count = await jobService.getJobCountByBusinessId(business.id);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/type/:type/count
  async getCountByType(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const count = await jobService.getJobCountByType(type);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/jobs/status/:status/count
  async getCountByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.params;
      const count = await jobService.getJobCountByStatus(status as never);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }
}

// Helper guard so unauthorized callers can't access admin-only endpoints.
export function assertAdmin(role: Role | undefined): void {
  if (role !== Role.ADMIN) {
    const err = new Error('Forbidden');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export const jobController = new JobController();
