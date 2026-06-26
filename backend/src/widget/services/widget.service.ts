import { Widget, Position, Theme } from '@prisma/client';
import { widgetRepository } from '../repositories/widget.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  WidgetCreatedEvent,
  WidgetDeletedEvent,
  WidgetUpdatedEvent,
} from '../events/widget.event';
import { widgetListener } from '../listeners/widget.listener';

export interface CreateWidgetInput {
  title?: string;
  description?: string;
  theme?: Theme;
  position?: Position;
  isEnabled?: boolean;
  customCss?: string;
}

export type UpdateWidgetInput = Partial<CreateWidgetInput>;

// Build "<BusinessName>_ai" with a unique suffix on collision.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'business';
}

export async function deriveUniqueWidgetSlug(
  businessName: string,
  exceptId?: string,
): Promise<string> {
  const base = `${slugify(businessName)}_ai`;
  if (!(await widgetRepository.isSlugTaken(base, exceptId))) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}_${i}`;
    if (!(await widgetRepository.isSlugTaken(candidate, exceptId))) return candidate;
  }
  throw new Error('Could not allocate unique widget slug');
}

export class WidgetService {
  async getWidgetsByBusinessId(businessId: string): Promise<Widget[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    return widgetRepository.findManyByBusinessId(businessId);
  }

  async getWidgetsByBusinessIds(businessIds: string[]): Promise<Widget[]> {
    return widgetRepository.findManyByBusinessIds(businessIds);
  }

  async getWidgetById(id: string): Promise<Widget> {
    const w = await widgetRepository.findById(id);
    if (!w) throw new Error('Widget not found');
    return w;
  }

  // Public lookup — used by /<slug> embeddable route on the frontend.
  async getWidgetBySlug(slug: string): Promise<Widget> {
    const w = await widgetRepository.findBySlug(slug);
    if (!w) throw new Error('Widget not found');
    return w;
  }

  async createWidget(businessId: string, data: CreateWidgetInput): Promise<Widget> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const title = data.title ?? `${business.name}_ai`;
    const slug = await deriveUniqueWidgetSlug(title);
    const widget = await widgetRepository.createWidget({
      businessId,
      title,
      description: data.description ?? null,
      slug,
      theme: data.theme,
      position: data.position,
      isEnabled: data.isEnabled,
      customCss: data.customCss ?? null,
    });
    await widgetListener.onWidgetCreated(new WidgetCreatedEvent(widget.id, businessId));
    return widget;
  }

  async updateWidget(id: string, data: UpdateWidgetInput): Promise<Widget> {
    const widget = await widgetRepository.findById(id);
    if (!widget) throw new Error('Widget not found');

    const updated = await widgetRepository.updateWidget(widget.id, {
      title: data.title,
      theme: data.theme,
      position: data.position,
      isEnabled: data.isEnabled,
      customCss: data.customCss === undefined ? undefined : data.customCss,
      description: data.description === undefined ? undefined : data.description,
    });
    await widgetListener.onWidgetUpdated(new WidgetUpdatedEvent(updated.id, data));
    return updated;
  }

  async deleteWidget(id: string): Promise<Widget> {
    const widget = await widgetRepository.findById(id);
    if (!widget) throw new Error('Widget not found');
    const deleted = await widgetRepository.deleteWidget(widget.id);
    await widgetListener.onWidgetDeleted(new WidgetDeletedEvent(deleted.id));
    return deleted;
  }
}

export const widgetService = new WidgetService();