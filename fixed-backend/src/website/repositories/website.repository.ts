import { prisma } from '../../lib/prisma';
import { Website, WebsitePage } from '@prisma/client';

export class WebsiteRepository {
  async findById(id: string): Promise<Website | null> {
    return prisma.website.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<Website | null> {
    return prisma.website.findFirst({ where: { businessId } });
  }

  async createWebsite(data: {
    businessId: string;
    url: string;
    title?: string | null;
    description?: string | null;
    faviconUrl?: string | null;
  }): Promise<Website> {
    // URL is globally unique in the schema. If another business already
    // uses this URL, repurpose that row for the new business so we don't
    // crash with P2002.
    const existing = await prisma.website.findUnique({ where: { url: data.url } })
    if (existing) {
      return prisma.website.update({
        where: { id: existing.id },
        data: {
          businessId: data.businessId,
          title: data.title ?? null,
          description: data.description ?? null,
          faviconUrl: data.faviconUrl ?? null,
          crawlStatus: 'pending',
          pageCount: 0,
        },
      })
    }
    return prisma.website.create({
      data: {
        businessId: data.businessId,
        url: data.url,
        title: data.title ?? null,
        description: data.description ?? null,
        faviconUrl: data.faviconUrl ?? null,
      },
    })
  }

  async updateWebsite(
    id: string,
    data: Partial<{
      url: string;
      title: string;
      description: string;
      faviconUrl: string;
      crawlStatus: string;
      lastCrawled: Date | null;
      pageCount: number;
    }>,
  ): Promise<Website> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) sanitized[key] = value;
    }
    return prisma.website.update({ where: { id }, data: sanitized });
  }

  async deleteWebsite(id: string): Promise<Website> {
    return prisma.website.delete({ where: { id } });
  }

  async updateCrawlStatus(
    id: string,
    status: string,
    pageCount?: number,
  ): Promise<Website> {
    return prisma.website.update({
      where: { id },
      data: {
        crawlStatus: status,
        lastCrawled: new Date(),
        pageCount: pageCount ?? 0,
      },
    });
  }

  async createPage(data: {
    websiteId: string;
    url: string;
    title?: string | null;
    content?: string | null;
    summary?: string | null;
  }): Promise<WebsitePage> {
    return prisma.websitePage.create({
      data: {
        websiteId: data.websiteId,
        url: data.url,
        title: data.title ?? null,
        content: data.content ?? null,
        summary: data.summary ?? null,
      },
    });
  }

  async getPagesByWebsiteId(websiteId: string): Promise<WebsitePage[]> {
    return prisma.websitePage.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deletePagesByWebsiteId(websiteId: string): Promise<void> {
    await prisma.websitePage.deleteMany({ where: { websiteId } });
  }

  async countByBusinessId(businessId: string): Promise<number> {
    return prisma.website.count({ where: { businessId } });
  }
}

export const websiteRepository = new WebsiteRepository();
