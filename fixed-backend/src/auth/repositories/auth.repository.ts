import { prisma } from '../../lib/prisma';
import { User } from '@prisma/client';

// Auth repository for user-related database operations
export class AuthRepository {
  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email }
    });
  }

  // Find user by ID
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  // Create new user
  async createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    verificationToken?: string;
    verificationTokenExpiry?: Date;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        verificationToken: data.verificationToken,
        verificationTokenExpiry: data.verificationTokenExpiry
      }
    });
  }

  // Update user verification status
  async verifyUser(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      }
    });
  }

  // Update user password
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { passwordHash }
    });
  }

  // Set reset token
  async setResetToken(
    id: string,
    token: string,
    expiry: Date
  ): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry
      }
    });
  }

  // Find user by reset token
  async findByResetToken(token: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });
  }

  // Clear reset token
  async clearResetToken(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        resetToken: null,
        resetTokenExpiry: null
      }
    });
  }

  // Update user refresh token (we'll store in separate table via service)
  // This is just for user record updates
  async updateUser(id: string, data: Partial<Omit<User, 'id'>>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data
    });
  }
}

// Export singleton instance
export const authRepository = new AuthRepository();