// Business events for domain-driven design
export class BusinessCreatedEvent {
  public readonly businessId: string;
  public readonly userId: string;
  public readonly name: string;
  public readonly industry: string;
  public readonly timestamp: Date;

  constructor(businessId: string, userId: string, name: string, industry: string) {
    this.businessId = businessId;
    this.userId = userId;
    this.name = name;
    this.industry = industry;
    this.timestamp = new Date();
  }
}

export class BusinessUpdatedEvent {
  public readonly businessId: string;
  public readonly updates: Partial<{
    name: string;
    description?: string;
    websiteUrl?: string;
    industry: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
  }>;
  public readonly timestamp: Date;

  constructor(businessId: string, updates: Partial<{
    name: string;
    description?: string;
    websiteUrl?: string;
    industry: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
  }>) {
    this.businessId = businessId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class BusinessDeletedEvent {
  public readonly businessId: string;
  public readonly timestamp: Date;

  constructor(businessId: string) {
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}