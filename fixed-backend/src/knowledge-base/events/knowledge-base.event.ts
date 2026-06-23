// Knowledge base events for domain-driven design
export class KnowledgeBaseCreatedEvent {
  public readonly knowledgeBaseId: string;
  public readonly businessId: string;
  public readonly timestamp: Date;

  constructor(knowledgeBaseId: string, businessId: string) {
    this.knowledgeBaseId = knowledgeBaseId;
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}

export class KnowledgeBaseUpdatedEvent {
  public readonly knowledgeBaseId: string;
  public readonly updates: Partial<{
    name: string;
    description?: string;
    documentCount: number;
    pageCount: number;
    chunkCount: number;
    isReady: boolean;
  }>;
  public readonly timestamp: Date;

  constructor(knowledgeBaseId: string, updates: Partial<{
    name: string;
    description?: string;
    documentCount: number;
    pageCount: number;
    chunkCount: number;
    isReady: boolean;
  }>) {
    this.knowledgeBaseId = knowledgeBaseId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class KnowledgeBaseDeletedEvent {
  public readonly knowledgeBaseId: string;
  public readonly timestamp: Date;

  constructor(knowledgeBaseId: string) {
    this.knowledgeBaseId = knowledgeBaseId;
    this.timestamp = new Date();
  }
}