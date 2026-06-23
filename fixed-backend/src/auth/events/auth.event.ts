// Auth events for domain-driven design
export class UserRegisteredEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly timestamp: Date;

  constructor(userId: string, email: string) {
    this.userId = userId;
    this.email = email;
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

export class UserLoggedInEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly timestamp: Date;

  constructor(userId: string, email: string) {
    this.userId = userId;
    this.email = email;
    this.timestamp = new Date();
  }
}

export class PasswordResetEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly timestamp: Date;

  constructor(userId: string, email: string) {
    this.userId = userId;
    this.email = email;
    this.timestamp = new Date();
  }
}

export class UserLoggedOutEvent {
  public readonly userId: string;
  public readonly timestamp: Date;

  constructor(userId: string) {
    this.userId = userId;
    this.timestamp = new Date();
  }
}
