import { prisma } from '../../lib/prisma';
import { BusinessSettings } from '@prisma/client';

export class BusinessSettingsRepository {
  async findByBusinessId(businessId: string): Promise<BusinessSettings | null> {
    return prisma.businessSettings.findUnique({ where: { businessId } });
  }

  async upsert(
    businessId: string,
    data: Partial<{
      timezone: string;
      language: string;
      emailNotifications: boolean;
      analyticsSharing: boolean;
      dataRetentionDays: number;
    }>,
  ): Promise<BusinessSettings> {
    return prisma.businessSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        businessId,
        timezone: data.timezone ?? 'UTC',
        language: data.language ?? 'en',
        emailNotifications: data.emailNotifications ?? true,
        analyticsSharing: data.analyticsSharing ?? true,
        dataRetentionDays: data.dataRetentionDays ?? 90,
      },
    });
  }

  async update(
    businessId: string,
    data: Partial<{
      timezone: string;
      language: string;
      emailNotifications: boolean;
      analyticsSharing: boolean;
      dataRetentionDays: number;
    }>,
  ): Promise<BusinessSettings> {
    return prisma.businessSettings.update({ where: { businessId }, data });
  }
}

export const businessSettingsRepository = new BusinessSettingsRepository();
