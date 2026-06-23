import { prisma } from '../../lib/prisma';
import { Analytic, MetricType, Prisma } from '@prisma/client';

// The Prisma client generates the model name in singular form ('Analytic')
// but the repository / service / DB column stays 'analytics' to match the
// existing API contract.

export class AnalyticsRepository {
  async findById(id: string): Promise<Analytic | null> {
    return prisma.analytic.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<Analytic[]> {
    return prisma.analytic.findMany({
      where: { businessId },
      orderBy: { date: 'desc' },
    });
  }

  async findByBusinessIdAndMetricType(
    businessId: string,
    metricType: MetricType,
  ): Promise<Analytic[]> {
    return prisma.analytic.findMany({
      where: { businessId, metricType },
      orderBy: { date: 'desc' },
    });
  }

  async findLatestByBusinessIdAndMetricType(
    businessId: string,
    metricType: MetricType,
  ): Promise<Analytic | null> {
    return prisma.analytic.findFirst({
      where: { businessId, metricType },
      orderBy: { date: 'desc' },
    });
  }

  async createAnalytics(data: {
    businessId: string;
    metricType: MetricType;
    metricValue: number;
    labels?: Prisma.InputJsonValue;
    date?: Date;
  }): Promise<Analytic> {
    return prisma.analytic.create({
      data: {
        businessId: data.businessId,
        metricType: data.metricType,
        metricValue: data.metricValue,
        labels: data.labels ?? Prisma.JsonNull,
        date: data.date ?? new Date(),
      },
    });
  }

  async updateAnalytics(
    id: string,
    data: Partial<{
      metricType: MetricType;
      metricValue: number;
      labels: Prisma.InputJsonValue;
      date: Date;
    }>,
  ): Promise<Analytic> {
    return prisma.analytic.update({ where: { id }, data });
  }

  async deleteAnalytics(id: string): Promise<Analytic> {
    return prisma.analytic.delete({ where: { id } });
  }

  async countByBusinessId(businessId: string): Promise<number> {
    return prisma.analytic.count({ where: { businessId } });
  }

  async deleteOldAnalytics(businessId: string, daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const result = await prisma.analytic.deleteMany({
      where: { businessId, date: { lt: cutoffDate } },
    });
    return result.count;
  }
}

export const analyticsRepository = new AnalyticsRepository();
