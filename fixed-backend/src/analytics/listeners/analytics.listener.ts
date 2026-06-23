import logger from '../../utils/logger';
import {
  AnalyticsCreatedEvent,
  AnalyticsDeletedBatchEvent,
  AnalyticsDeletedEvent,
  AnalyticsUpdatedEvent,
} from '../events/analytics.event';

export class AnalyticsListener {
  async onAnalyticsCreated(event: AnalyticsCreatedEvent): Promise<void> {
    try {
      logger.info(
        {
          analyticsId: event.analyticsId,
          businessId: event.businessId,
          metricType: event.metricType,
          metricValue: event.metricValue,
        },
        'Analytics created',
      );
    } catch (err) {
      logger.error('Error in onAnalyticsCreated listener', err);
    }
  }

  async onAnalyticsUpdated(event: AnalyticsUpdatedEvent): Promise<void> {
    try {
      logger.info({ analyticsId: event.analyticsId }, 'Analytics updated');
    } catch (err) {
      logger.error('Error in onAnalyticsUpdated listener', err);
    }
  }

  async onAnalyticsDeleted(event: AnalyticsDeletedEvent): Promise<void> {
    try {
      logger.info({ analyticsId: event.analyticsId }, 'Analytics deleted');
    } catch (err) {
      logger.error('Error in onAnalyticsDeleted listener', err);
    }
  }

  async onAnalyticsDeletedBatch(event: AnalyticsDeletedBatchEvent): Promise<void> {
    try {
      logger.info(
        {
          businessId: event.businessId,
          count: event.count,
          daysToKeep: event.daysToKeep,
        },
        'Analytics batch deleted',
      );
    } catch (err) {
      logger.error('Error in onAnalyticsDeletedBatch listener', err);
    }
  }
}

export const analyticsListener = new AnalyticsListener();
