// Job events for domain-driven design
export class JobCreatedEvent {
  public readonly jobId: string;
  public readonly name: string;
  public readonly type: string;
  public readonly businessId: string | null;
  public readonly timestamp: Date;

  constructor(jobId: string, name: string, type: string, businessId: string | null) {
    this.jobId = jobId;
    this.name = name;
    this.type = type;
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}

export class JobUpdatedEvent {
  public readonly jobId: string;
  public readonly updates: Partial<{
    name: string;
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
    status: string;
  }>;
  public readonly timestamp: Date;

  constructor(jobId: string, updates: Partial<{
    name: string;
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
    status: string;
  }>) {
    this.jobId = jobId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class JobDeletedEvent {
  public readonly jobId: string;
  public readonly timestamp: Date;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.timestamp = new Date();
  }
}

export class JobStartedEvent {
  public readonly jobId: string;
  public readonly timestamp: Date;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.timestamp = new Date();
  }
}

export class JobCompletedEvent {
  public readonly jobId: string;
  public readonly timestamp: Date;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.timestamp = new Date();
  }
}

export class JobFailedEvent {
  public readonly jobId: string;
  public readonly error: string;
  public readonly timestamp: Date;

  constructor(jobId: string, error: string) {
    this.jobId = jobId;
    this.error = error;
    this.timestamp = new Date();
  }
}