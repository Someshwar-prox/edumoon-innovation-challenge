// Notification events for domain-driven design
export class NotificationCreatedEvent {
  public readonly notificationId: string;
  public readonly businessId: string;
  public readonly type: string;
  public readonly timestamp: Date;

  constructor(notificationId: string, businessId: string, type: string) {
    this.notificationId = notificationId;
    this.businessId = businessId;
    this.type = type;
    this.timestamp = new Date();
  }
}

export class NotificationUpdatedEvent {
  public readonly notificationId: string;
  public readonly updates: Partial<{
    title: string;
    message: string;
    type: string;
    isRead: boolean;
  }>;
  public readonly timestamp: Date;

  constructor(notificationId: string, updates: Partial<{
    title: string;
    message: string;
    type: string;
    isRead: boolean;
  }>) {
    this.notificationId = notificationId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class NotificationDeletedEvent {
  public readonly notificationId: string;
  public readonly timestamp: Date;

  constructor(notificationId: string) {
    this.notificationId = notificationId;
    this.timestamp = new Date();
  }
}

export class NotificationMarkedAsReadEvent {
  public readonly notificationId: string;
  public readonly timestamp: Date;

  constructor(notificationId: string) {
    this.notificationId = notificationId;
    this.timestamp = new Date();
  }
}

export class NotificationMarkedAsUnreadEvent {
  public readonly notificationId: string;
  public readonly timestamp: Date;

  constructor(notificationId: string) {
    this.notificationId = notificationId;
    this.timestamp = new Date();
  }
}

export class NotificationAllMarkedAsReadEvent {
  public readonly businessId: string;
  public readonly count: number;
  public readonly timestamp: Date;

  constructor(businessId: string, count: number) {
    this.businessId = businessId;
    this.count = count;
    this.timestamp = new Date();
  }
}