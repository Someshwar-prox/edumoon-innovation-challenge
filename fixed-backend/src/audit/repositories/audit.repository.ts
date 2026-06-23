import { prisma } from '../../lib/prisma';
import { Audit, Prisma } from '@prisma/client';

export class AuditRepository {
  async findById(id: string): Promise<Audit | null> {
    return prisma.audit.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<Audit[]> {
    return prisma.audit.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestByBusinessId(businessId: string): Promise<Audit | null> {
    return prisma.audit.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAudit(data: {
    businessId: string;
    readinessScore: number;
    businessSummary?: string | null;
    aiOpportunities?: Prisma.InputJsonValue;
    automationSuggestions?: Prisma.InputJsonValue;
    estimatedBenefits?: Prisma.InputJsonValue;
    strengths?: Prisma.InputJsonValue;
    weaknesses?: Prisma.InputJsonValue;
    suggestedSolutions?: Prisma.InputJsonValue;
    expectedRoi?: Prisma.InputJsonValue;
  }): Promise<Audit> {
    return prisma.audit.create({
      data: {
        businessId: data.businessId,
        readinessScore: data.readinessScore,
        businessSummary: data.businessSummary ?? null,
        aiOpportunities: data.aiOpportunities ?? Prisma.JsonNull,
        automationSuggestions: data.automationSuggestions ?? Prisma.JsonNull,
        estimatedBenefits: data.estimatedBenefits ?? Prisma.JsonNull,
        strengths: data.strengths ?? Prisma.JsonNull,
        weaknesses: data.weaknesses ?? Prisma.JsonNull,
        suggestedSolutions: data.suggestedSolutions ?? Prisma.JsonNull,
        expectedRoi: data.expectedRoi ?? Prisma.JsonNull,
      },
    });
  }

  async updateAudit(
    id: string,
    data: Partial<{
      readinessScore: number;
      businessSummary: string;
      aiOpportunities: Prisma.InputJsonValue;
      automationSuggestions: Prisma.InputJsonValue;
      estimatedBenefits: Prisma.InputJsonValue;
      strengths: Prisma.InputJsonValue;
      weaknesses: Prisma.InputJsonValue;
      suggestedSolutions: Prisma.InputJsonValue;
      expectedRoi: Prisma.InputJsonValue;
    }>,
  ): Promise<Audit> {
    return prisma.audit.update({ where: { id }, data });
  }

  async deleteAudit(id: string): Promise<Audit> {
    return prisma.audit.delete({ where: { id } });
  }

  async countByBusinessId(businessId: string): Promise<number> {
    return prisma.audit.count({ where: { businessId } });
  }
}

export const auditRepository = new AuditRepository();
