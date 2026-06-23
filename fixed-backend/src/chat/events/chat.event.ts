// Chat events for domain-driven design
export class ChatSessionCreatedEvent {
  public readonly chatSessionId: string;
  public readonly visitorId: string;
  public readonly businessId: string;
  public readonly sessionToken: string;
  public readonly timestamp: Date;

  constructor(chatSessionId: string, visitorId: string, businessId: string, sessionToken: string) {
    this.chatSessionId = chatSessionId;
    this.visitorId = visitorId;
    this.businessId = businessId;
    this.sessionToken = sessionToken;
    this.timestamp = new Date();
  }
}

export class ChatSessionEndedEvent {
  public readonly chatSessionId: string;
  public readonly satisfactionScore: number | null;
  public readonly feedback: string | null;
  public readonly timestamp: Date;

  constructor(chatSessionId: string, satisfactionScore: number | null, feedback: string | null) {
    this.chatSessionId = chatSessionId;
    this.satisfactionScore = satisfactionScore;
    this.feedback = feedback;
    this.timestamp = new Date();
  }
}

export class MessageCreatedEvent {
  public readonly messageId: string;
  public readonly chatSessionId: string;
  public readonly content: string;
  public readonly isFromUser: boolean;
  public readonly timestamp: Date;

  constructor(messageId: string, chatSessionId: string, content: string, isFromUser: boolean) {
    this.messageId = messageId;
    this.chatSessionId = chatSessionId;
    this.content = content;
    this.isFromUser = isFromUser;
    this.timestamp = new Date();
  }
}

export class VisitorCreatedEvent {
  public readonly visitorId: string;
  public readonly sessionId: string;
  public readonly timestamp: Date;

  constructor(visitorId: string, sessionId: string) {
    this.visitorId = visitorId;
    this.sessionId = sessionId;
    this.timestamp = new Date();
  }
}