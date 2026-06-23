import { Request, Response, NextFunction } from 'express';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
  readySchema,
} from '../validators/knowledge-base.validator';
import { knowledgeBaseService } from '../services/knowledge-base.service';

async function resolveBusiness(req: Request): Promise<string | { error: string; status: number }> {
  const userId = req.user?.id;
  if (!userId) return { error: 'Unauthorized', status: 401 };
  const business = await businessRepository.findByUserId(userId);
  if (!business) return { error: 'Business not found', status: 404 };
  return business.id;
}

export class KnowledgeBaseController {
  // GET /api/knowledge-base
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const knowledgeBase = await knowledgeBaseService.getKnowledgeBaseByBusinessId(resolved);
      return res.status(200).json({ knowledgeBase });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/knowledge-base
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = createKnowledgeBaseSchema.parse(req.body);
      const knowledgeBase = await knowledgeBaseService.createKnowledgeBase(resolved, body);
      return res.status(201).json({
        message: 'Knowledge base created successfully',
        knowledgeBase,
      });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/knowledge-base
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = updateKnowledgeBaseSchema.parse(req.body);
      const knowledgeBase = await knowledgeBaseService.updateKnowledgeBase(resolved, body);
      return res.status(200).json({
        message: 'Knowledge base updated successfully',
        knowledgeBase,
      });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/knowledge-base
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      await knowledgeBaseService.deleteKnowledgeBase(resolved);
      return res.status(200).json({ message: 'Knowledge base deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/knowledge-base/document
  async addDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const knowledgeBase = await knowledgeBaseService.addDocumentToKnowledgeBase(resolved);
      return res.status(200).json({
        message: 'Document added to knowledge base successfully',
        knowledgeBase,
      });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/knowledge-base/document
  async removeDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const knowledgeBase = await knowledgeBaseService.removeDocumentFromKnowledgeBase(resolved);
      return res.status(200).json({
        message: 'Document removed from knowledge base successfully',
        knowledgeBase,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/knowledge-base/page
  async addPage(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const knowledgeBase = await knowledgeBaseService.addPageToKnowledgeBase(resolved);
      return res.status(200).json({
        message: 'Page added to knowledge base successfully',
        knowledgeBase,
      });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/knowledge-base/page
  async removePage(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const knowledgeBase = await knowledgeBaseService.removePageFromKnowledgeBase(resolved);
      return res.status(200).json({
        message: 'Page removed from knowledge base successfully',
        knowledgeBase,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/knowledge-base/ready
  async setReady(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = readySchema.parse(req.body);
      const knowledgeBase = await knowledgeBaseService.setKnowledgeBaseReady(resolved, body.isReady);
      return res.status(200).json({
        message: `Knowledge base marked as ${body.isReady ? 'ready' : 'not ready'}`,
        knowledgeBase,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/knowledge-base/stats
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const stats = await knowledgeBaseService.getKnowledgeBaseStats(resolved);
      return res.status(200).json({ knowledgeBase: stats });
    } catch (error) {
      return next(error);
    }
  }
}

export const knowledgeBaseController = new KnowledgeBaseController();
