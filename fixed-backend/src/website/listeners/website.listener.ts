import logger from '../../utils/logger';
import {
  WebsiteCrawlCompletedEvent,
  WebsiteCrawlFailedEvent,
  WebsiteCrawlStartedEvent,
  WebsiteDeletedEvent,
  WebsiteUpdatedEvent,
} from '../events/website.event';

export class WebsiteListener {
  async onWebsiteUpdated(event: WebsiteUpdatedEvent): Promise<void> {
    try {
      logger.info(
        { websiteId: event.websiteId, businessId: event.businessId },
        'Website updated',
      );
    } catch (err) {
      logger.error('Error in onWebsiteUpdated listener', err);
    }
  }

  async onWebsiteDeleted(event: WebsiteDeletedEvent): Promise<void> {
    try {
      logger.info({ websiteId: event.websiteId }, 'Website deleted');
    } catch (err) {
      logger.error('Error in onWebsiteDeleted listener', err);
    }
  }

  async onWebsiteCrawlStarted(event: WebsiteCrawlStartedEvent): Promise<void> {
    try {
      logger.info(
        { websiteId: event.websiteId, businessId: event.businessId },
        'Website crawl started',
      );
    } catch (err) {
      logger.error('Error in onWebsiteCrawlStarted listener', err);
    }
  }

  async onWebsiteCrawlCompleted(event: WebsiteCrawlCompletedEvent): Promise<void> {
    try {
      logger.info(
        {
          websiteId: event.websiteId,
          businessId: event.businessId,
          pagesCrawled: event.pagesCrawled,
        },
        'Website crawl completed',
      );
    } catch (err) {
      logger.error('Error in onWebsiteCrawlCompleted listener', err);
    }
  }

  async onWebsiteCrawlFailed(event: WebsiteCrawlFailedEvent): Promise<void> {
    try {
      logger.info(
        { websiteId: event.websiteId, error: event.error },
        'Website crawl failed',
      );
    } catch (err) {
      logger.error('Error in onWebsiteCrawlFailed listener', err);
    }
  }
}

export const websiteListener = new WebsiteListener();
