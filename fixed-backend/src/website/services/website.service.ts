import axios from 'axios';
import * as cheerio from 'cheerio';
import { Website, WebsitePage } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { websiteRepository } from '../repositories/website.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import { config } from '../../config';
import logger from '../../utils/logger';
import {
  WebsiteCrawlCompletedEvent,
  WebsiteCrawlFailedEvent,
  WebsiteCrawlStartedEvent,
  WebsiteDeletedEvent,
  WebsiteUpdatedEvent,
} from '../events/website.event';
import { websiteListener } from '../listeners/website.listener';

interface AiWebsiteProfile {
  company_summary?: string;
  services?: Array<{ name: string; description?: string }>;
  products?: Array<{ name: string; description?: string }>;
  faqs?: Array<{ question: string; answer?: string }>;
  contact?: { email?: string; phone?: string; social?: Record<string, string> };
}

export class WebsiteService {
  async setWebsiteUrl(businessId: string, url: string): Promise<Website> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const existing = await websiteRepository.findByBusinessId(businessId);
    
    // If the user submits a URL that was previously used by another business
    // (e.g. testing with amazon.com across multiple accounts), delete the
    // old row so we can safely update this business's row without a P2002 conflict.
    const urlOwner = await prisma.website.findUnique({ where: { url } });
    if (urlOwner && existing && urlOwner.id !== existing.id) {
      await prisma.website.delete({ where: { id: urlOwner.id } });
    }

    const website = existing
      ? await websiteRepository.updateWebsite(existing.id, { url, crawlStatus: 'pending', pageCount: 0 })
      : await websiteRepository.createWebsite({ businessId, url });

    await websiteListener.onWebsiteUpdated(
      new WebsiteUpdatedEvent(website.id, businessId, { url }),
    );
    return website;
  }

  async getWebsiteByBusinessId(businessId: string): Promise<Website> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');
    return website;
  }

  async updateWebsite(
    businessId: string,
    data: { url?: string; title?: string; description?: string; faviconUrl?: string },
  ): Promise<Website> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    const sanitized: Parameters<typeof websiteRepository.updateWebsite>[1] = {};
    if (data.url !== undefined) sanitized.url = data.url;
    if (data.title !== undefined) sanitized.title = data.title;
    if (data.description !== undefined) sanitized.description = data.description;
    if (data.faviconUrl !== undefined) sanitized.faviconUrl = data.faviconUrl;

    const updated = await websiteRepository.updateWebsite(website.id, sanitized);
    await websiteListener.onWebsiteUpdated(
      new WebsiteUpdatedEvent(updated.id, businessId, {
        url: data.url,
        title: data.title,
        description: data.description,
        faviconUrl: data.faviconUrl,
      }),
    );
    return updated;
  }

  async deleteWebsite(businessId: string): Promise<Website> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    const deleted = await websiteRepository.deleteWebsite(website.id);
    await websiteListener.onWebsiteDeleted(new WebsiteDeletedEvent(deleted.id, website.businessId));
    return deleted;
  }

  async deleteWebsiteForBusiness(businessId: string): Promise<Website> {
    return this.deleteWebsite(businessId);
  }

  async crawlWebsite(businessId: string): Promise<{ website: Website; pagesCrawled: number }> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    await websiteRepository.updateCrawlStatus(website.id, 'in_progress');
    await websiteListener.onWebsiteCrawlStarted(
      new WebsiteCrawlStartedEvent(website.id, businessId),
    );

    try {
      // 1) Cheap local crawl — title / description / favicon / one page row
      // Use a real-browser User-Agent because many sites (Flipkart, Amazon,
      // etc.) 403 the default axios/curl UA. Keep an Accept-Language header
      // because some sites return a different (often empty) page for
      // non-en-US locales.
      const response = await axios.get<string>(website.url, {
        timeout: 15_000,
        maxRedirects: 5,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
        },
        // Don't reject on 4xx — we want to see the error in the body for
        // bot-block pages. The ai-service /v1/analyze-website will retry
        // with its own browser-style UA anyway.
        validateStatus: (s) => s < 500,
        responseType: 'text',
      });

      // If the cheap crawl got blocked (403/429 from a bot-detection page),
      // fall through to the ai-service call anyway — it uses Trafilatura
      // and httpx with a proper UA and may still succeed. We just don't
      // have a title/description to save from this attempt.
      if (response.status >= 400) {
        logger.warn(
          { url: website.url, status: response.status },
          'local crawl blocked; falling back to ai-service',
        );
        const aiProfile = await this.proxyAnalyzeWebsite(businessId, website.url);
        if (!aiProfile) {
          logger.warn({ url: website.url }, 'Both local and ai-service crawls failed (likely bot protection). Allowing onboarding to proceed with 0 pages.');
          await websiteRepository.updateCrawlStatus(website.id, 'completed', 0);
          await websiteListener.onWebsiteCrawlCompleted(
            new WebsiteCrawlCompletedEvent(website.id, businessId, 0),
          );
          return { website, pagesCrawled: 0 };
        }
        await websiteRepository.updateCrawlStatus(website.id, 'completed', 1);
        await websiteListener.onWebsiteCrawlCompleted(
          new WebsiteCrawlCompletedEvent(website.id, businessId, 1),
        );
        return { website, pagesCrawled: 1 };
      }

      const $ = cheerio.load(response.data);
      const title = $('title').first().text().trim() || undefined;
      const description =
        $('meta[name="description"]').attr('content') || undefined;
      const faviconHref =
        $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || undefined;

      let absoluteFaviconUrl: string | undefined = faviconHref ?? undefined;
      if (faviconHref && !faviconHref.startsWith('http')) {
        try {
          const base = new URL(website.url);
          absoluteFaviconUrl = new URL(faviconHref, base.origin).toString();
        } catch (err) {
          logger.warn({ err, faviconHref }, 'Failed to resolve absolute favicon URL');
        }
      }

      await websiteRepository.updateWebsite(website.id, {
        title: title ?? undefined,
        description: description ?? undefined,
        faviconUrl: absoluteFaviconUrl ?? undefined,
      });

      await websiteRepository.createPage({
        websiteId: website.id,
        url: website.url,
        title: title ?? undefined,
        summary: description ?? undefined,
      });

      // 2) Defer the heavy BFS crawl + Groq structuring to the ai-service
      //    so vectors land in the per-business kb_master. Failures here are
      //    non-fatal — the local page row above is still good.
      const aiProfile = await this.proxyAnalyzeWebsite(businessId, website.url);
      const mergedDescription = aiProfile?.company_summary || description;

      if (mergedDescription) {
        await websiteRepository.updateWebsite(website.id, {
          description: mergedDescription,
        });
      }

      await websiteRepository.updateCrawlStatus(website.id, 'completed', 1);

      await websiteListener.onWebsiteCrawlCompleted(
        new WebsiteCrawlCompletedEvent(website.id, businessId, 1),
      );

      return { website, pagesCrawled: 1 };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await websiteRepository.updateCrawlStatus(website.id, 'failed');
      await websiteListener.onWebsiteCrawlFailed(
        new WebsiteCrawlFailedEvent(website.id, businessId, message),
      );
      throw err;
    }
  }

  private async proxyAnalyzeWebsite(
    businessId: string,
    url: string,
  ): Promise<AiWebsiteProfile | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.externalApiKey) {
        headers['X-Api-Key'] = config.externalApiKey;
      }
      const response = await axios.post<{ profile?: AiWebsiteProfile }>(
        `${config.externalDocumentServiceUrl}/v1/analyze-website`,
        { business_id: businessId, url, max_pages: 3, force_recrawl: false },
        { headers, timeout: 60_000 },
      );
      return response.data?.profile ?? null;
    } catch (err) {
      logger.warn({ err, url }, 'ai-service /v1/analyze-website failed; local crawl kept');
      return null;
    }
  }

  async recrawlWebsite(businessId: string): Promise<{ website: Website; pagesCrawled: number }> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    await websiteRepository.deletePagesByWebsiteId(website.id);
    return this.crawlWebsite(businessId);
  }

  async getWebsitePages(businessId: string): Promise<WebsitePage[]> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');
    return websiteRepository.getPagesByWebsiteId(website.id);
  }
}

export const websiteService = new WebsiteService();
