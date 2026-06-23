import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { businessRepository } from '../../business/repositories/business.repository';
import { businessSettingsService } from '../services/business-settings.service';
import { updateBusinessSettingsSchema } from '../validators/business-settings.validator';

export class BusinessSettingsController {
  // GET /api/business-settings/me
  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const settings = await businessSettingsService.getSettingsOrNull(business.id);
      return res.status(200).json({ settings: settings ?? {} });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/business-settings/me
  async updateMine(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const body = updateBusinessSettingsSchema.parse(req.body);
      const settings = await businessSettingsService.updateSettings(business.id, body);
      return res.status(200).json({ settings });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/business-settings/:businessId — admin override
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== Role.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { businessId } = req.params;
      const settings = await businessSettingsService.getSettingsOrNull(businessId);
      return res.status(200).json({ settings: settings ?? {} });
    } catch (error) {
      return next(error);
    }
  }
}

export const businessSettingsController = new BusinessSettingsController();
