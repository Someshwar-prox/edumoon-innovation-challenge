// Audit events for domain-driven design
export class AuditCreatedEvent {
  public readonly auditId: string;
  public readonly businessId: string;
  public readonly readinessScore: number;
  public readonly timestamp: Date;

  constructor(auditId: string, businessId: string, readinessScore: number) {
    this.auditId = auditId;
    this.businessId = businessId;
    this.readinessScore = readinessScore;
    this.timestamp = new Date();
  }
}

export class AuditUpdatedEvent {
  public readonly auditId: string;
  public readonly updates: {
    readinessScore?: number;
    businessSummary?: string;
    aiOpportunities?: string;
    automationSuggestions?: string;
    estimatedBenefits?: string;
    strengths?: string;
    weaknesses?: string;
    suggestedSolutions?: string;
    expectedRoi?: string;
  };
  public readonly timestamp: Date;

  constructor(
    auditId: string,
    updates: {
      readinessScore?: number;
      businessSummary?: string;
      aiOpportunities?: string;
      automationSuggestions?: string;
      estimatedBenefits?: string;
      strengths?: string;
      weaknesses?: string;
      suggestedSolutions?: string;
      expectedRoi?: string;
    },
  ) {
    this.auditId = auditId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class AuditDeletedEvent {
  public readonly auditId: string;
  public readonly timestamp: Date;

  constructor(auditId: string) {
    this.auditId = auditId;
    this.timestamp = new Date();
  }
}
