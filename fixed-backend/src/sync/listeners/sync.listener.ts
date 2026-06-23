import logger from '../../utils/logger';
import {
  SyncJobCompletedEvent,
  SyncJobCreatedEvent,
  SyncJobDeletedEvent,
  SyncJobFailedEvent,
  SyncJobStartedEvent,
  SyncJobUpdatedEvent,
} from '../events/sync.event';

export class SyncListener {
  async onSyncJobCreated(event: SyncJobCreatedEvent): Promise<void> {
    try {
      logger.info(
        { syncJobId: event.syncJobId, businessId: event.businessId, type: event.type },
        'Sync job created',
      );
    } catch (err) {
      logger.error('Error in onSyncJobCreated listener', err);
    }
  }

  async onSyncJobUpdated(event: SyncJobUpdatedEvent): Promise<void> {
    try {
      logger.info({ syncJobId: event.syncJobId }, 'Sync job updated');
    } catch (err) {
      logger.error('Error in onSyncJobUpdated listener', err);
    }
  }

  async onSyncJobDeleted(event: SyncJobDeletedEvent): Promise<void> {
    try {
      logger.info({ syncJobId: event.syncJobId }, 'Sync job deleted');
    } catch (err) {
      logger.error('Error in onSyncJobDeleted listener', err);
    }
  }

  async onSyncJobStarted(event: SyncJobStartedEvent): Promise<void> {
    try {
      logger.info(
        { syncJobId: event.syncJobId, businessId: event.businessId },
        'Sync job started',
      );
    } catch (err) {
      logger.error('Error in onSyncJobStarted listener', err);
    }
  }

  async onSyncJobCompleted(event: SyncJobCompletedEvent): Promise<void> {
    try {
      logger.info(
        {
          syncJobId: event.syncJobId,
          businessId: event.businessId,
          pagesProcessed: event.pagesProcessed,
          documentsProcessed: event.documentsProcessed,
        },
        'Sync job completed',
      );
    } catch (err) {
      logger.error('Error in onSyncJobCompleted listener', err);
    }
  }

  async onSyncJobFailed(event: SyncJobFailedEvent): Promise<void> {
    try {
      logger.info(
        { syncJobId: event.syncJobId, error: event.error },
        'Sync job failed',
      );
    } catch (err) {
      logger.error('Error in onSyncJobFailed listener', err);
    }
  }
}

export const syncListener = new SyncListener();
