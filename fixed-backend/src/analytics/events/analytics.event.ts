// Analytics events for domain-driven design
export class AnalyticsCreatedEvent {
  public readonly analyticsId: string;
  public readonly businessId: string;
  public readonly metricType: string;
  public readonly metricValue: number;
  public readonly timestamp: Date;

  constructor(analyticsId: string, businessId: string, metricType: string, metricValue: number) {
    this.analyticsId = analyticsId;
    this.businessId = businessId;
    this.metricType = metricType;
    this.metricValue = metricValue;
    this.timestamp = new Date();
  }
}

export class AnalyticsUpdatedEvent {
  public readonly analyticsId: string;
  public readonly updates: {
    metricValue?: number;
    labels?: string;
    date?: Date;
  };
  public readonly timestamp: Date;

  constructor(analyticsId: string, updates: { metricValue?: number; labels?: string; date?: Date }) {
    this.analyticsId = analyticsId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class AnalyticsDeletedEvent {
  public readonly analyticsId: string;
  public readonly timestamp: Date;

  constructor(analyticsId: string) {
    this.analyticsId = analyticsId;
    this.timestamp = new Date();
  }
}

// Batch deleted event for old analytics cleanup
export class AnalyticsDeletedBatchEvent {
  public readonly businessId: string;
  public readonly daysToKeep: number;
  public readonly count: number;
  public readonly timestamp: Date;

  constructor(businessId: string, daysToKeep: number, count: number) {
    this.businessId = businessId;
    this.daysToKeep = daysToKeep;
    this.count = count;
    this.timestamp = new Date();
  }
}
