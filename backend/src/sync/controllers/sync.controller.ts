import { Request, Response, NextFunction } from 'express';
import { businessRepository } from '../../business/repositories/business.repository';
import { createSyncJobSchema, updateSyncJobSchema } from '../validators/sync.validator';
import { syncService } from '../services/sync.service';

async function resolveBusiness(req: Request): Promise<string | { error: string; status: number }> {
  const userId = req.user?.id;
  if (!userId) return { error: 'Unauthorized', status: 401 };

  const businessId = req.body?.businessId || req.query?.businessId;
  if (businessId) {
    const business = await businessRepository.findById(businessId as string);
    if (!business || business.userId !== userId) {
      return { error: 'Business not found or forbidden', status: 404 };
    }
    return business.id;
  }

  // Fallback to first business if none provided
  const business = await businessRepository.findByUserId(userId);
  if (!business) return { error: 'Business not found', status: 404 };
  return business.id;
}

export class SyncController {
  // POST /api/sync
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = createSyncJobSchema.parse(req.body);
      const syncJob = await syncService.createSyncJob(resolved, body);
      return res.status(201).json({ message: 'Sync job created successfully', syncJob });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/sync/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const syncJob = await syncService.getSyncJobById(id);
      return res.status(200).json({ syncJob });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/sync
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const syncJobs = await syncService.getSyncJobsByBusinessId(resolved);
      return res.status(200).json({ syncJobs });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/sync/status/:status
  async getByBusinessIdAndStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const { status } = req.params;
      const syncJobs = await syncService.getSyncJobsByBusinessIdAndStatus(resolved, status);
      return res.status(200).json({ syncJobs });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/sync/type/:type/latest
  async getLatestByBusinessIdAndType(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const { type } = req.params;
      const syncJob = await syncService.getLatestSyncJobByBusinessIdAndType(resolved, type);
      if (!syncJob) return res.status(404).json({ error: 'No sync job found for this type' });
      return res.status(200).json({ syncJob });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/sync/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = updateSyncJobSchema.parse(req.body);
      const syncJob = await syncService.updateSyncJob(id, {
        status: body.status,
        errorMessage: body.errorMessage ?? undefined,
        pagesProcessed: body.pagesProcessed,
        documentsProcessed: body.documentsProcessed,
      });
      return res.status(200).json({ message: 'Sync job updated successfully', syncJob });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/sync/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await syncService.deleteSyncJob(id);
      return res.status(200).json({ message: 'Sync job deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/sync/website
  async startWebsiteSync(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const result = await syncService.startWebsiteSync(resolved);
      return res.status(200).json({
        message: 'Website sync completed successfully',
        syncJob: result.syncJob,
        websiteResult: result.result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/sync/document
  async startDocumentSync(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const result = await syncService.startDocumentSync(resolved);
      return res.status(200).json({
        message: 'Document sync completed successfully',
        syncJob: result.syncJob,
        processedCount: result.processedCount,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/sync/knowledge-base
  async startKnowledgeBaseSync(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const result = await syncService.startKnowledgeBaseSync(resolved);
      return res.status(200).json({
        message: 'Knowledge base sync completed successfully',
        syncJob: result.syncJob,
        pageCountChange: result.pageCountChange,
        documentCountChange: result.documentCountChange,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/sync/count
  async getCount(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const count = await syncService.getSyncJobCount(resolved);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }
}

export const syncController = new SyncController();
