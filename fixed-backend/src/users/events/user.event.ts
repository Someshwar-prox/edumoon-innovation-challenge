// User events for domain-driven design
export class UserCreatedEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly timestamp: Date;

  constructor(userId: string, email: string) {
    this.userId = userId;
    this.email = email;
    this.timestamp = new Date();
  }
}

export class UserUpdatedEvent {
  public readonly userId: string;
  public readonly updates: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }>;
  public readonly timestamp: Date;

  constructor(userId: string, updates: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }>) {
    this.userId = userId;
    this.updates = updates;
    this.timestamp = new Date();
  }
}

export class UserDeletedEvent {
  public readonly userId: string;
  public readonly timestamp: Date;

  constructor(userId: string) {
    this.userId = userId;
    this.timestamp = new Date();
  }
}

export class UserVerifiedEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly timestamp: Date;

  constructor(userId: string, email: string) {
    this.userId = userId;
    this.email = email;
    this.timestamp = new Date();
  }
}

export class PasswordUpdatedEvent {
  public readonly userId: string;
  public readonly timestamp: Date;

  constructor(userId: string) {
    this.userId = userId;
    this.timestamp = new Date();
  }
}