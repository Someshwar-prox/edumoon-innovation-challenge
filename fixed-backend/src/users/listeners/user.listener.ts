import logger from '../../utils/logger';
import {
  PasswordUpdatedEvent,
  UserCreatedEvent,
  UserDeletedEvent,
  UserUpdatedEvent,
  UserVerifiedEvent,
} from '../events/user.event';

export class UserListener {
  async onUserCreated(event: UserCreatedEvent): Promise<void> {
    try {
      logger.info({ userId: event.userId, email: event.email }, 'User created');
    } catch (err) {
      logger.error('Error in onUserCreated listener', err);
    }
  }

  async onUserUpdated(event: UserUpdatedEvent): Promise<void> {
    try {
      logger.info({ userId: event.userId }, 'User updated');
    } catch (err) {
      logger.error('Error in onUserUpdated listener', err);
    }
  }

  async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    try {
      logger.info({ userId: event.userId }, 'User deleted');
    } catch (err) {
      logger.error('Error in onUserDeleted listener', err);
    }
  }

  async onUserVerified(event: UserVerifiedEvent): Promise<void> {
    try {
      logger.info({ userId: event.userId, email: event.email }, 'User verified');
    } catch (err) {
      logger.error('Error in onUserVerified listener', err);
    }
  }

  async onPasswordUpdated(event: PasswordUpdatedEvent): Promise<void> {
    try {
      logger.info({ userId: event.userId }, 'Password updated');
    } catch (err) {
      logger.error('Error in onPasswordUpdated listener', err);
    }
  }
}

export const userListener = new UserListener();
