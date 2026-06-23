import logger from '../../utils/logger';
import {
  JobCompletedEvent,
  JobCreatedEvent,
  JobDeletedEvent,
  JobFailedEvent,
  JobStartedEvent,
  JobUpdatedEvent,
} from '../events/job.event';

export class JobListener {
  async onJobCreated(event: JobCreatedEvent): Promise<void> {
    try {
      logger.info(
        { jobId: event.jobId, name: event.name, type: event.type, businessId: event.businessId },
        'Job created',
      );
    } catch (err) {
      logger.error('Error in onJobCreated listener', err);
    }
  }

  async onJobUpdated(event: JobUpdatedEvent): Promise<void> {
    try {
      logger.info({ jobId: event.jobId }, 'Job updated');
    } catch (err) {
      logger.error('Error in onJobUpdated listener', err);
    }
  }

  async onJobDeleted(event: JobDeletedEvent): Promise<void> {
    try {
      logger.info({ jobId: event.jobId }, 'Job deleted');
    } catch (err) {
      logger.error('Error in onJobDeleted listener', err);
    }
  }

  async onJobStarted(event: JobStartedEvent): Promise<void> {
    try {
      logger.info({ jobId: event.jobId }, 'Job started');
    } catch (err) {
      logger.error('Error in onJobStarted listener', err);
    }
  }

  async onJobCompleted(event: JobCompletedEvent): Promise<void> {
    try {
      logger.info({ jobId: event.jobId }, 'Job completed');
    } catch (err) {
      logger.error('Error in onJobCompleted listener', err);
    }
  }

  async onJobFailed(event: JobFailedEvent): Promise<void> {
    try {
      logger.info({ jobId: event.jobId, error: event.error }, 'Job failed');
    } catch (err) {
      logger.error('Error in onJobFailed listener', err);
    }
  }
}

export const jobListener = new JobListener();
