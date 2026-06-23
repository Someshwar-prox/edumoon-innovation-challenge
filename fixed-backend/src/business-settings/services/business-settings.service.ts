import { BusinessSettings } from '@prisma/client';
import { businessSettingsRepository } from '../repositories/business-settings.repository';

export interface UpdateBusinessSettingsInput {
  timezone?: string;
  language?: string;
  emailNotifications?: boolean;
  analyticsSharing?: boolean;
  dataRetentionDays?: number;
}

export class BusinessSettingsService {
  async getSettings(businessId: string): Promise<BusinessSettings> {
    const settings = await businessSettingsRepository.findByBusinessId(businessId);
    if (!settings) {
      throw new Error('Business settings not found');
    }
    return settings;
  }

  async getSettingsOrNull(businessId: string): Promise<BusinessSettings | null> {
    return businessSettingsRepository.findByBusinessId(businessId);
  }

  async updateSettings(
    businessId: string,
    data: UpdateBusinessSettingsInput,
  ): Promise<BusinessSettings> {
    return businessSettingsRepository.upsert(businessId, data);
  }
}

export const businessSettingsService = new BusinessSettingsService();
