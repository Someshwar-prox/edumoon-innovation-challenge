import { Request, Response, NextFunction } from 'express';
import { createAuditSchema, generateReportSchema, updateAuditSchema } from '../validators/audit.validator';
import { auditService } from '../services/audit.service';

export class AuditController {
  // POST /api/audit — create an audit (typically called by the AI service)
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createAuditSchema.parse(req.body);
      const audit = await auditService.createAudit(body);
      return res.status(201).json({ audit });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/audit/generate/:businessId — proxy to ai-service and persist
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const body = generateReportSchema.parse(req.body ?? {});
      const audit = await auditService.generateReport(businessId, {
        focusAreas: body.focusAreas,
        includeDocuments: body.includeDocuments,
        language: body.language,
      });
      return res.status(201).json({ audit });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/audit/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const audit = await auditService.getById(id);
      return res.status(200).json({ audit });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/audit/business/:businessId
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const audits = await auditService.getByBusinessId(businessId);
      return res.status(200).json({ audits });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/audit/business/:businessId/latest
  async getLatest(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const audit = await auditService.getLatestByBusinessId(businessId);
      if (!audit) return res.status(404).json({ error: 'No audits found' });
      return res.status(200).json({ audit });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/audit/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = updateAuditSchema.parse(req.body);
      const sanitized: Parameters<typeof auditService.updateAudit>[1] = {};
      if (body.readinessScore !== undefined) sanitized.readinessScore = body.readinessScore;
      if (body.businessSummary !== undefined) {
        sanitized.businessSummary = body.businessSummary ?? undefined;
      }
      if (body.aiOpportunities !== undefined) sanitized.aiOpportunities = body.aiOpportunities ?? undefined;
      if (body.automationSuggestions !== undefined) {
        sanitized.automationSuggestions = body.automationSuggestions ?? undefined;
      }
      if (body.estimatedBenefits !== undefined) sanitized.estimatedBenefits = body.estimatedBenefits ?? undefined;
      if (body.strengths !== undefined) sanitized.strengths = body.strengths ?? undefined;
      if (body.weaknesses !== undefined) sanitized.weaknesses = body.weaknesses ?? undefined;
      if (body.suggestedSolutions !== undefined) {
        sanitized.suggestedSolutions = body.suggestedSolutions ?? undefined;
      }
      if (body.expectedRoi !== undefined) sanitized.expectedRoi = body.expectedRoi ?? undefined;

      const audit = await auditService.updateAudit(id, sanitized);
      return res.status(200).json({ audit });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/audit/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await auditService.deleteAudit(id);
      return res.status(200).json({ message: 'Audit deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/audit/business/:businessId/count
  async getCount(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const count = await auditService.getCount(businessId);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }

  // Sanity probe
  async getAll(_req: Request, res: Response) {
    return res.json({ message: 'audit works' });
  }
}

export const auditController = new AuditController();
