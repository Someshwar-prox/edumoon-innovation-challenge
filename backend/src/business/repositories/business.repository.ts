import { prisma } from '../../lib/prisma';
import { Business, BusinessSettings, Industry, Prisma } from '@prisma/client';

export interface BusinessListFilters {
  industry?: Industry;
  name?: string;
  isActive?: boolean;
}

export interface BusinessListResult {
  businesses: Business[];
  total: number;
}

// Business repository
export class BusinessRepository {
  async findById(id: string): Promise<Business | null> {
    return prisma.business.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Business | null> {
    return prisma.business.findFirst({ where: { userId } });
  }

  async findManyByUserId(userId: string): Promise<Business[]> {
    return prisma.business.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async createBusiness(data: {
    userId: string;
    name: string;
    description?: string;
    websiteUrl?: string;
    industry: Industry;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
  }): Promise<Business> {
    return prisma.business.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        websiteUrl: data.websiteUrl ?? null,
        industry: data.industry,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        address: data.address ?? null,
      },
    });
  }

  async updateBusiness(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      websiteUrl: string | null;
      industry: Industry;
      contactEmail: string | null;
      contactPhone: string | null;
      address: string | null;
      isActive: boolean;
    }>,
  ): Promise<Business> {
    return prisma.business.update({ where: { id }, data });
  }

  async deleteBusiness(id: string): Promise<Business> {
    return prisma.business.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findMany(
    skip = 0,
    take = 10,
    filters: BusinessListFilters = {},
  ): Promise<BusinessListResult> {
    const where: Prisma.BusinessWhereInput = { deletedAt: null };

    if (filters.industry) where.industry = filters.industry;
    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [businesses, total] = await prisma.$transaction([
      prisma.business.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.business.count({ where }),
    ]);

    return { businesses, total };
  }

  async countActive(): Promise<number> {
    return prisma.business.count({ where: { deletedAt: null, isActive: true } });
  }

  // Settings helpers (lives here for legacy callers; new code should
  // import from business-settings.repository directly).
  async createBusinessSettings(data: {
    businessId: string;
    timezone?: string;
    language?: string;
    emailNotifications?: boolean;
    analyticsSharing?: boolean;
    dataRetentionDays?: number;
  }): Promise<BusinessSettings> {
    return prisma.businessSettings.create({
      data: {
        businessId: data.businessId,
        timezone: data.timezone ?? 'UTC',
        language: data.language ?? 'en',
        emailNotifications: data.emailNotifications ?? true,
        analyticsSharing: data.analyticsSharing ?? true,
        dataRetentionDays: data.dataRetentionDays ?? 90,
      },
    });
  }

  async updateBusinessSettings(
    id: string,
    data: Partial<Omit<BusinessSettings, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BusinessSettings> {
    return prisma.businessSettings.update({ where: { id }, data });
  }

  async findBusinessSettingsByBusinessId(
    businessId: string,
  ): Promise<BusinessSettings | null> {
    return prisma.businessSettings.findUnique({ where: { businessId } });
  }
}

export const businessRepository = new BusinessRepository();
