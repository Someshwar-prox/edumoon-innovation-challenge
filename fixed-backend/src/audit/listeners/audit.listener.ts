import logger from '../../utils/logger';
import {
  AuditCreatedEvent,
  AuditDeletedEvent,
  AuditUpdatedEvent,
} from '../events/audit.event';

export class AuditListener {
  async onAuditCreated(event: AuditCreatedEvent): Promise<void> {
    try {
      logger.info(
        {
          auditId: event.auditId,
          businessId: event.businessId,
          readinessScore: event.readinessScore,
        },
        'Audit created',
      );
    } catch (err) {
      logger.error('Error in onAuditCreated listener', err);
    }
  }

  async onAuditUpdated(event: AuditUpdatedEvent): Promise<void> {
    try {
      logger.info({ auditId: event.auditId }, 'Audit updated');
    } catch (err) {
      logger.error('Error in onAuditUpdated listener', err);
    }
  }

  async onAuditDeleted(event: AuditDeletedEvent): Promise<void> {
    try {
      logger.info({ auditId: event.auditId }, 'Audit deleted');
    } catch (err) {
      logger.error('Error in onAuditDeleted listener', err);
    }
  }
}

export const auditListener = new AuditListener();
