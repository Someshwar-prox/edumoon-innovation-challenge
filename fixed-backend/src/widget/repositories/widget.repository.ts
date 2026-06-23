import { prisma } from '../../lib/prisma';
import { Widget, Position, Theme, Prisma } from '@prisma/client';

export class WidgetRepository {
  async findById(id: string): Promise<Widget | null> {
    return prisma.widget.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Widget | null> {
    return prisma.widget.findUnique({ where: { slug } });
  }

  async findByBusinessId(businessId: string): Promise<Widget | null> {
    return prisma.widget.findFirst({ where: { businessId } });
  }

  async findManyByBusinessId(businessId: string): Promise<Widget[]> {
    return prisma.widget.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }

  async createWidget(data: {
    businessId: string;
    title: string;
    slug: string;
    theme?: Theme;
    position?: Position;
    isEnabled?: boolean;
    customCss?: string | null;
    description?: string | null;
  }): Promise<Widget> {
    return prisma.widget.create({
      data: {
        businessId: data.businessId,
        title: data.title,
        slug: data.slug,
        theme: data.theme ?? Theme.LIGHT,
        position: data.position ?? Position.BOTTOM_RIGHT,
        isEnabled: data.isEnabled ?? true,
        customCss: data.customCss ?? null,
        description: data.description ?? null,
      },
    });
  }

  async updateWidget(
    id: string,
    data: Partial<{
      title: string;
      slug: string;
      theme: Theme;
      position: Position;
      isEnabled: boolean;
      customCss: string | null;
      description: string | null;
    }>,
  ): Promise<Widget> {
    return prisma.widget.update({ where: { id }, data });
  }

  async deleteWidget(id: string): Promise<Widget> {
    return prisma.widget.delete({ where: { id } });
  }

  // Used when slug collisions happen across businesses; checks if a slug
  // is taken (optionally excluding one widget id during renames).
  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const where: Prisma.WidgetWhereUniqueInput = { slug };
    const found = await prisma.widget.findUnique({ where });
    if (!found) return false;
    if (exceptId && found.id === exceptId) return false;
    return true;
  }
}

export const widgetRepository = new WidgetRepository();