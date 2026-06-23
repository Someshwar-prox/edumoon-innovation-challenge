import logger from '../../utils/logger';
import {
  WidgetCreatedEvent,
  WidgetDeletedEvent,
  WidgetUpdatedEvent,
} from '../events/widget.event';

export class WidgetListener {
  async onWidgetCreated(event: WidgetCreatedEvent): Promise<void> {
    try {
      logger.info({ widgetId: event.widgetId, businessId: event.businessId }, 'Widget created');
    } catch (err) {
      logger.error('Error in onWidgetCreated listener', err);
    }
  }

  async onWidgetUpdated(event: WidgetUpdatedEvent): Promise<void> {
    try {
      logger.info({ widgetId: event.widgetId }, 'Widget updated');
    } catch (err) {
      logger.error('Error in onWidgetUpdated listener', err);
    }
  }

  async onWidgetDeleted(event: WidgetDeletedEvent): Promise<void> {
    try {
      logger.info({ widgetId: event.widgetId }, 'Widget deleted');
    } catch (err) {
      logger.error('Error in onWidgetDeleted listener', err);
    }
  }
}

export const widgetListener = new WidgetListener();
