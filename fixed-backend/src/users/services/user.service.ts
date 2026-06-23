import bcrypt from 'bcryptjs';
import { Role, User } from '@prisma/client';
import { userRepository } from '../repositories/user.repository';
import { authRepository } from '../../auth/repositories/auth.repository';
import logger from '../../utils/logger';
import {
  PasswordUpdatedEvent,
  UserDeletedEvent,
  UserUpdatedEvent,
  UserVerifiedEvent,
} from '../events/user.event';
import { userListener } from '../listeners/user.listener';

const SALT_ROUNDS = 12;

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: Role;
  password?: string;
}

export class UserService {
  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------
  async getUserById(id: string): Promise<User> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async getUsers(
    skip: number,
    take: number,
    filters: { role?: Role; isVerified?: boolean; searchTerm?: string } = {},
  ) {
    return userRepository.findMany(skip, take, filters);
  }

  async getUserCount(): Promise<number> {
    return userRepository.countActive();
  }

  // ---------------------------------------------------------------------------
  // Mutate
  // ---------------------------------------------------------------------------
  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new Error('User not found');
    }

    if (data.email && data.email !== existing.email) {
      const emailExists = await userRepository.findByEmail(data.email);
      if (emailExists) {
        throw new Error('Email already in use');
      }
    }

    const updateData: Parameters<typeof userRepository.updateUser>[1] = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      role: data.role,
    };

    if (data.password) {
      updateData.passwordHash = await this.hashPassword(data.password);
    }

    const user = await userRepository.updateUser(id, updateData);

    await userListener.onUserUpdated(
      new UserUpdatedEvent(user.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
      }),
    );

    return user;
  }

  async updatePassword(id: string, currentPassword: string, newPassword: string): Promise<User> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new Error('User not found');
    }
    const ok = await bcrypt.compare(currentPassword, existing.passwordHash);
    if (!ok) {
      throw new Error('Current password is incorrect');
    }
    const passwordHash = await this.hashPassword(newPassword);
    const user = await userRepository.updatePassword(id, passwordHash);
    await userListener.onPasswordUpdated(new PasswordUpdatedEvent(user.id));
    return user;
  }

  async deleteUser(id: string): Promise<User> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new Error('User not found');
    }
    const user = await userRepository.deleteUser(id);
    await userListener.onUserDeleted(new UserDeletedEvent(user.id));
    return user;
  }

  async verifyUser(id: string): Promise<User> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new Error('User not found');
    }
    const user = await userRepository.verifyUser(id);
    await userListener.onUserVerified(new UserVerifiedEvent(user.id, user.email));
    return user;
  }

  // ---------------------------------------------------------------------------
  // Password reset delegation
  // ---------------------------------------------------------------------------
  async setResetToken(id: string, token: string, expiry: Date): Promise<User> {
    return authRepository.setResetToken(id, token, expiry);
  }

  async findByResetToken(token: string): Promise<User> {
    const user = await userRepository.findByResetToken(token);
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }
    return user;
  }

  async clearResetToken(id: string): Promise<User> {
    return authRepository.clearResetToken(id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  }
}

export const userService = new UserService();
