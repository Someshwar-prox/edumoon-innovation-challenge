// Website events for domain-driven design
export class WebsiteUpdatedEvent {
  public readonly websiteId: string;
  public readonly businessId: string;
  public readonly updates: Partial<{
    url: string;
    title?: string;
    description?: string;
    faviconUrl?: string;
  }>;
  public readonly timestamp: Date;

  constructor(websiteId: string, businessId: string, updates: Partial<{
    url: string;
    title?: string;
    description?: string;
    faviconUrl?: string;
  }>) {
    this.websiteId = websiteId;
    this.businessId = businessId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class WebsiteDeletedEvent {
  public readonly websiteId: string;
  public readonly businessId: string;
  public readonly timestamp: Date;

  constructor(websiteId: string, businessId: string) {
    this.websiteId = websiteId;
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}

export class WebsiteCrawlStartedEvent {
  public readonly websiteId: string;
  public readonly businessId: string;
  public readonly timestamp: Date;

  constructor(websiteId: string, businessId: string) {
    this.websiteId = websiteId;
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}

export class WebsiteCrawlCompletedEvent {
  public readonly websiteId: string;
  public readonly businessId: string;
  public readonly pagesCrawled: number;
  public readonly timestamp: Date;

  constructor(websiteId: string, businessId: string, pagesCrawled: number) {
    this.websiteId = websiteId;
    this.businessId = businessId;
    this.pagesCrawled = pagesCrawled;
    this.timestamp = new Date();
  }
}

export class WebsiteCrawlFailedEvent {
  public readonly websiteId: string;
  public readonly businessId: string;
  public readonly error: string;
  public readonly timestamp: Date;

  constructor(websiteId: string, businessId: string, error: string) {
    this.websiteId = websiteId;
    this.businessId = businessId;
    this.error = error;
    this.timestamp = new Date();
  }
}