// Widget events for domain-driven design
export class WidgetCreatedEvent {
  public readonly widgetId: string;
  public readonly businessId: string;
  public readonly timestamp: Date;

  constructor(widgetId: string, businessId: string) {
    this.widgetId = widgetId;
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}

export class WidgetUpdatedEvent {
  public readonly widgetId: string;
  public readonly updates: Partial<{
    title: string;
    theme: string;
    position: string;
    isEnabled: boolean;
    customCss?: string;
  }>;
  public readonly timestamp: Date;

  constructor(widgetId: string, updates: Partial<{
    title: string;
    theme: string;
    position: string;
    isEnabled: boolean;
    customCss?: string;
  }>) {
    this.widgetId = widgetId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class WidgetDeletedEvent {
  public readonly widgetId: string;
  public readonly timestamp: Date;

  constructor(widgetId: string) {
    this.widgetId = widgetId;
    this.timestamp = new Date();
  }
}