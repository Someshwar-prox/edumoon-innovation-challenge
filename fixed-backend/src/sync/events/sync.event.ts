// Sync events for domain-driven design
export class SyncJobCreatedEvent {
  public readonly syncJobId: string;
  public readonly businessId: string;
  public readonly type: string;
  public readonly timestamp: Date;

  constructor(syncJobId: string, businessId: string, type: string) {
    this.syncJobId = syncJobId;
    this.businessId = businessId;
    this.type = type;
    this.timestamp = new Date();
  }
}

export class SyncJobUpdatedEvent {
  public readonly syncJobId: string;
  public readonly updates: Partial<{
    type: string;
    status: string;
    startedAt: Date;
    completedAt: Date;
    errorMessage: string;
    pagesProcessed: number;
    documentsProcessed: number;
  }>;
  public readonly timestamp: Date;

  constructor(syncJobId: string, updates: Partial<{
    type: string;
    status: string;
    startedAt: Date;
    completedAt: Date;
    errorMessage: string;
    pagesProcessed: number;
    documentsProcessed: number;
  }>) {
    this.syncJobId = syncJobId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class SyncJobDeletedEvent {
  public readonly syncJobId: string;
  public readonly timestamp: Date;

  constructor(syncJobId: string) {
    this.syncJobId = syncJobId;
    this.timestamp = new Date();
  }
}

export class SyncJobStartedEvent {
  public readonly syncJobId: string;
  public readonly businessId: string;
  public readonly timestamp: Date;

  constructor(syncJobId: string, businessId: string) {
    this.syncJobId = syncJobId;
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}

export class SyncJobCompletedEvent {
  public readonly syncJobId: string;
  public readonly businessId: string;
  public readonly pagesProcessed: number;
  public readonly documentsProcessed: number;
  public readonly timestamp: Date;

  constructor(syncJobId: string, businessId: string, pagesProcessed: number, documentsProcessed: number) {
    this.syncJobId = syncJobId;
    this.businessId = businessId;
    this.pagesProcessed = pagesProcessed;
    this.documentsProcessed = documentsProcessed;
    this.timestamp = new Date();
  }
}

export class SyncJobFailedEvent {
  public readonly syncJobId: string;
  public readonly businessId: string;
  public readonly error: string;
  public readonly timestamp: Date;

  constructor(syncJobId: string, businessId: string, error: string) {
    this.syncJobId = syncJobId;
    this.businessId = businessId;
    this.error = error;
    this.timestamp = new Date();
  }
}