import logger from '../../utils/logger';
import {
  DocumentDeletedEvent,
  DocumentProcessedEvent,
  DocumentUploadedEvent,
} from '../events/document.event';

export class DocumentListener {
  // Handle document uploaded event
  async onDocumentUploaded(event: DocumentUploadedEvent): Promise<void> {
    try {
      logger.info(
        {
          documentId: event.documentId,
          filename: event.filename,
          businessId: event.businessId,
        },
        'Document uploaded',
      );
    } catch (err) {
      logger.error('Error in onDocumentUploaded listener', err);
    }
  }

  // Handle document processed event
  async onDocumentProcessed(event: DocumentProcessedEvent): Promise<void> {
    try {
      logger.info(
        { documentId: event.documentId, chunkCount: event.chunkCount },
        'Document processed',
      );
    } catch (err) {
      logger.error('Error in onDocumentProcessed listener', err);
    }
  }

  // Handle document deleted event
  async onDocumentDeleted(event: DocumentDeletedEvent): Promise<void> {
    try {
      logger.info(
        { documentId: event.documentId, businessId: event.businessId },
        'Document deleted',
      );
    } catch (err) {
      logger.error('Error in onDocumentDeleted listener', err);
    }
  }
}

export const documentListener = new DocumentListener();
