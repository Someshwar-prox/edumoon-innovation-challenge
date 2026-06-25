import { Industry } from '@prisma/client';
import { Business } from '@prisma/client';
import { businessRepository } from '../repositories/business.repository';
import { wipeBusinessKnowledge } from './knowledge-wipe.service';

export interface UpdateBusinessInput {
  name?: string;
  description?: string | null;
  websiteUrl?: string | null;
  industry?: Industry;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export class BusinessService {
  async getBusinessById(id: string): Promise<Business> {
    const business = await businessRepository.findById(id);
    if (!business) {
      throw new Error('Business not found');
    }
    return business;
  }

  async getBusinessByUserId(userId: string): Promise<Business | null> {
    return businessRepository.findByUserId(userId);
  }

  async getBusinessesByUserId(userId: string): Promise<Business[]> {
    return businessRepository.findManyByUserId(userId);
  }

  async listBusinesses(
    skip: number,
    take: number,
    filters: { industry?: Industry; name?: string; isActive?: boolean } = {},
  ) {
    return businessRepository.findMany(skip, take, filters);
  }

  async getBusinessCount(): Promise<number> {
    return businessRepository.countActive();
  }

  async createBusiness(input: {
    userId: string;
    name: string;
    description?: string;
    websiteUrl?: string;
    industry: Industry;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
  }): Promise<Business> {
    return businessRepository.createBusiness(input);
  }

  async updateBusiness(id: string, data: UpdateBusinessInput): Promise<Business> {
    const existing = await businessRepository.findById(id);
    if (!existing) {
      throw new Error('Business not found');
    }
    const urlChanged =
      typeof data.websiteUrl === 'string' &&
      data.websiteUrl.length > 0 &&
      data.websiteUrl !== existing.websiteUrl;
    const updated = await businessRepository.updateBusiness(id, data);
    if (urlChanged) {
      // fire-and-forget; failure is logged inside the helper.
      void wipeBusinessKnowledge(id);
    }
    return updated;
  }

  async deleteBusiness(id: string): Promise<Business> {
    const existing = await businessRepository.findById(id);
    if (!existing) {
      throw new Error('Business not found');
    }
    // Wipe knowledge from Qdrant when business is deleted to prevent orphaned vectors
    void wipeBusinessKnowledge(id);
    return businessRepository.deleteBusiness(id);
  }
}

export const businessService = new BusinessService();
