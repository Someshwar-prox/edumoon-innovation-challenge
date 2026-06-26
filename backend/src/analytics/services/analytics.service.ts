import { Analytic, MetricType, Prisma } from '@prisma/client';
import { analyticsRepository } from '../repositories/analytics.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  AnalyticsCreatedEvent,
  AnalyticsDeletedBatchEvent,
  AnalyticsUpdatedEvent,
} from '../events/analytics.event';
import { analyticsListener } from '../listeners/analytics.listener';

export interface CreateAnalyticsInput {
  businessId: string;
  metricType: MetricType;
  metricValue: number;
  labels?: Record<string, unknown>;
  date?: Date;
}

export interface UpdateAnalyticsInput {
  metricType?: MetricType;
  metricValue?: number;
  labels?: Record<string, unknown> | null;
  date?: Date;
}

export class AnalyticsService {
  async getById(id: string): Promise<Analytic> {
    const a = await analyticsRepository.findById(id);
    if (!a) throw new Error('Analytics record not found');
    return a;
  }

  async getByBusinessId(businessId: string, limit = 100): Promise<Analytic[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    const all = await analyticsRepository.findByBusinessId(businessId);
    return all.slice(0, limit);
  }

  async getByMetricType(businessId: string, metricType: MetricType): Promise<Analytic[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return analyticsRepository.findByBusinessIdAndMetricType(businessId, metricType);
  }

  async getLatestByMetricType(
    businessId: string,
    metricType: MetricType,
  ): Promise<Analytic | null> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return analyticsRepository.findLatestByBusinessIdAndMetricType(businessId, metricType);
  }

  async createAnalytics(data: CreateAnalyticsInput): Promise<Analytic> {
    const business = await businessRepository.findById(data.businessId);
    if (!business) throw new Error('Business not found');

    const created = await analyticsRepository.createAnalytics({
      businessId: data.businessId,
      metricType: data.metricType,
      metricValue: data.metricValue,
      labels: data.labels ? (data.labels as Prisma.InputJsonValue) : undefined,
      date: data.date,
    });

    await analyticsListener.onAnalyticsCreated(
      new AnalyticsCreatedEvent(
        created.id,
        created.businessId,
        created.metricType,
        created.metricValue,
      ),
    );

    return created;
  }

  async updateAnalytics(id: string, data: UpdateAnalyticsInput): Promise<Analytic> {
    const existing = await analyticsRepository.findById(id);
    if (!existing) throw new Error('Analytics record not found');

    const updated = await analyticsRepository.updateAnalytics(id, {
      metricType: data.metricType,
      metricValue: data.metricValue,
      labels: data.labels ? (data.labels as Prisma.InputJsonValue) : undefined,
      date: data.date,
    });

    await analyticsListener.onAnalyticsUpdated(
      new AnalyticsUpdatedEvent(updated.id, {
        metricValue: data.metricValue,
        labels: JSON.stringify(data.labels ?? {}),
        date: data.date,
      }),
    );
    return updated;
  }

  async deleteAnalytics(id: string): Promise<Analytic> {
    const existing = await analyticsRepository.findById(id);
    if (!existing) throw new Error('Analytics record not found');
    return analyticsRepository.deleteAnalytics(id);
  }

  async applyRetention(businessId: string, daysToKeep: number): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    const count = await analyticsRepository.deleteOldAnalytics(businessId, daysToKeep);
    await analyticsListener.onAnalyticsDeletedBatch(
      new AnalyticsDeletedBatchEvent(businessId, daysToKeep, count),
    );
    return count;
  }

  async getCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    return analyticsRepository.countByBusinessId(businessId);
  }

  async getKpis(businessId: string): Promise<{ totalChats: number, activeChats: number, averageSatisfaction: number }> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');
    
    // Import prisma locally if not at the top
    const { prisma } = require('../../lib/prisma');
    
    const [totalChats, activeChats, agg] = await Promise.all([
      prisma.chatSession.count({ where: { businessId } }),
      prisma.chatSession.count({ where: { businessId, endedAt: null } }),
      prisma.chatSession.aggregate({
        where: { businessId, satisfactionScore: { not: null } },
        _avg: { satisfactionScore: true }
      })
    ]);

    return {
      totalChats,
      activeChats,
      averageSatisfaction: agg._avg.satisfactionScore ?? 0,
    };
  }
}

export const analyticsService = new AnalyticsService();
