import { Request, Response, NextFunction } from 'express';
import { businessRepository } from '../../business/repositories/business.repository';
import { createWidgetSchema, updateWidgetSchema } from '../validators/widget.validator';
import { widgetService } from '../services/widget.service';

async function resolveBusiness(req: Request): Promise<string | { error: string; status: number }> {
  const userId = req.user?.id;
  if (!userId) return { error: 'Unauthorized', status: 401 };
  const business = await businessRepository.findByUserId(userId);
  if (!business) return { error: 'Business not found', status: 404 };
  return business.id;
}

export class WidgetController {
  // GET /api/widgets — returns the current user's widgets
  async listByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const widgets = await widgetService.getWidgetsByBusinessId(resolved);
      return res.status(200).json({ widgets });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/widget/:id — single-widget lookup
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const widget = await widgetService.getWidgetById(req.params.id);
      if (widget.businessId !== resolved) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.status(200).json({ widget });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Widget not found';
      return res.status(404).json({ error: msg });
    }
  }

  // GET /api/widget/by-slug/:slug — public lookup for the /<slug> embed
  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const widget = await widgetService.getWidgetBySlug(req.params.slug);
      return res.status(200).json({ widget });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Widget not found';
      return res.status(404).json({ error: msg });
    }
  }

  // POST /api/widget
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = createWidgetSchema.parse(req.body);
      const widget = await widgetService.createWidget(resolved, body);
      return res.status(201).json({ message: 'Widget created successfully', widget });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/widget/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      
      const { id } = req.params;
      const widget = await widgetService.getWidgetById(id);
      if (widget.businessId !== resolved) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const body = updateWidgetSchema.parse(req.body);
      const updatedWidget = await widgetService.updateWidget(id, {
        title: body.title,
        theme: body.theme,
        position: body.position,
        isEnabled: body.isEnabled,
        customCss: body.customCss ?? undefined,
        description: body.description ?? undefined,
      });
      return res.status(200).json({ message: 'Widget updated successfully', widget: updatedWidget });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/widget/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }

      const { id } = req.params;
      const widget = await widgetService.getWidgetById(id);
      if (widget.businessId !== resolved) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await widgetService.deleteWidget(id);
      return res.status(200).json({ message: 'Widget deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }
}

export const widgetController = new WidgetController();