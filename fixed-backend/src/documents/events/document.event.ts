// Document events for domain-driven design
export class DocumentUploadedEvent {
  public readonly documentId: string;
  public readonly businessId: string;
  public readonly filename: string;
  public readonly size: number;
  public readonly type: string;
  public readonly timestamp: Date;

  constructor(documentId: string, businessId: string, filename: string, size: number, type: string) {
    this.documentId = documentId;
    this.businessId = businessId;
    this.filename = filename;
    this.size = size;
    this.type = type;
    this.timestamp = new Date();
  }
}

export class DocumentProcessedEvent {
  public readonly documentId: string;
  public readonly businessId: string;
  public readonly extractedTextLength: number;
  public readonly chunkCount: number;
  public readonly timestamp: Date;

  constructor(documentId: string, businessId: string, extractedTextLength: number, chunkCount: number) {
    this.documentId = documentId;
    this.businessId = businessId;
    this.extractedTextLength = extractedTextLength;
    this.chunkCount = chunkCount;
    this.timestamp = new Date();
  }
}

export class DocumentDeletedEvent {
  public readonly documentId: string;
  public readonly businessId: string;
  public readonly timestamp: Date;

  constructor(documentId: string, businessId: string) {
    this.documentId = documentId;
    this.businessId = businessId;
    this.timestamp = new Date();
  }
}