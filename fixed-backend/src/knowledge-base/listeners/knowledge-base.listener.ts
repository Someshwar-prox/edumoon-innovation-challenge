import logger from '../../utils/logger';
import {
  KnowledgeBaseCreatedEvent,
  KnowledgeBaseDeletedEvent,
  KnowledgeBaseUpdatedEvent,
} from '../events/knowledge-base.event';

export class KnowledgeBaseListener {
  async onKnowledgeBaseCreated(event: KnowledgeBaseCreatedEvent): Promise<void> {
    try {
      logger.info(
        { knowledgeBaseId: event.knowledgeBaseId, businessId: event.businessId },
        'Knowledge base created',
      );
    } catch (err) {
      logger.error('Error in onKnowledgeBaseCreated listener', err);
    }
  }

  async onKnowledgeBaseUpdated(event: KnowledgeBaseUpdatedEvent): Promise<void> {
    try {
      logger.info({ knowledgeBaseId: event.knowledgeBaseId }, 'Knowledge base updated');
    } catch (err) {
      logger.error('Error in onKnowledgeBaseUpdated listener', err);
    }
  }

  async onKnowledgeBaseDeleted(event: KnowledgeBaseDeletedEvent): Promise<void> {
    try {
      logger.info({ knowledgeBaseId: event.knowledgeBaseId }, 'Knowledge base deleted');
    } catch (err) {
      logger.error('Error in onKnowledgeBaseDeleted listener', err);
    }
  }
}

export const knowledgeBaseListener = new KnowledgeBaseListener();
