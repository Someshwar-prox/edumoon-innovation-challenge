import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  createAnalyticsSchema,
  updateAnalyticsSchema,
  analyticsQuerySchema,
  retentionSchema,
} from '../validators/analytics.validator';
import { analyticsService } from '../services/analytics.service';
import { authorize } from '../../middleware/authorization.middleware';

export class AnalyticsController {
  // POST /api/analytics — admin only
  create = [
    authorize([Role.ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createAnalyticsSchema.parse(req.body);
        if (!body.businessId) {
          return res.status(400).json({ error: 'businessId is required when admin creates analytics' });
        }
        const analytics = await analyticsService.createAnalytics({
          ...body,
          businessId: body.businessId,
        });
        return res.status(201).json({ analytics });
      } catch (error) {
        return next(error);
      }
    },
  ];

  // GET /api/analytics/:businessId
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const query = analyticsQuerySchema.parse(req.query);
      const items = await analyticsService.getByBusinessId(businessId, query.limit);
      return res.status(200).json({ analytics: items });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/analytics/:businessId/metric/:metricType
  async getByMetricType(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId, metricType } = req.params;
      const items = await analyticsService.getByMetricType(
        businessId,
        metricType as never,
      );
      return res.status(200).json({ analytics: items });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/analytics/:businessId/metric/:metricType/latest
  async getLatest(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId, metricType } = req.params;
      const latest = await analyticsService.getLatestByMetricType(
        businessId,
        metricType as never,
      );
      if (!latest) return res.status(404).json({ error: 'No analytics found' });
      return res.status(200).json({ analytics: latest });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/analytics/:id — admin only
  update = [
    authorize([Role.ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const body = updateAnalyticsSchema.parse(req.body);
        const analytics = await analyticsService.updateAnalytics(id, body);
        return res.status(200).json({ analytics });
      } catch (error) {
        return next(error);
      }
    },
  ];

  // DELETE /api/analytics/:id — admin only
  delete = [
    authorize([Role.ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        await analyticsService.deleteAnalytics(id);
        return res.status(200).json({ message: 'Analytics record deleted' });
      } catch (error) {
        return next(error);
      }
    },
  ];

  // POST /api/analytics/:businessId/retention — admin only
  applyRetention = [
    authorize([Role.ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { businessId } = req.params;
        const body = retentionSchema.parse(req.body);
        const removed = await analyticsService.applyRetention(
          businessId,
          body.daysToKeep,
        );
        return res.status(200).json({ removed });
      } catch (error) {
        return next(error);
      }
    },
  ];

  // GET /api/analytics/:businessId/count
  async getCount(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const count = await analyticsService.getCount(businessId);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/analytics/:businessId/kpis
  async getKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const kpis = await analyticsService.getKpis(businessId);
      return res.status(200).json(kpis);
    } catch (error) {
      return next(error);
    }
  }

  // Sanity probe (kept from original 'getAll' stub)
  async getAll(_req: Request, res: Response) {
    return res.json({ message: 'analytics works' });
  }
}

export const analyticsController = new AnalyticsController();
