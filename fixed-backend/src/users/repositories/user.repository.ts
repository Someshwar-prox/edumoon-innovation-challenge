import { prisma } from '../../lib/prisma';
import { Prisma, Role, User } from '@prisma/client';

export interface UserListFilters {
  role?: Role;
  isVerified?: boolean;
  searchTerm?: string;
}

export interface UserListResult {
  users: User[];
  total: number;
}

// User repository
export class UserRepository {
  // Find user by ID
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  // Find users with pagination and filters
  async findMany(
    skip = 0,
    take = 10,
    filters: UserListFilters = {},
  ): Promise<UserListResult> {
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (filters.role) {
      where.role = filters.role;
    }
    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }
    if (filters.searchTerm) {
      where.OR = [
        { firstName: { contains: filters.searchTerm, mode: 'insensitive' } },
        { lastName: { contains: filters.searchTerm, mode: 'insensitive' } },
        { email: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  // Update user
  async updateUser(
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      role: Role;
      passwordHash: string;
      isVerified: boolean;
    }>,
  ): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  // Soft delete user
  async deleteUser(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Verify user (clear verification token + flip isVerified)
  async verifyUser(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });
  }

  // Update user password
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  // Set reset token
  async setResetToken(id: string, token: string, expiry: Date): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });
  }

  // Find user by reset token (only valid, non-expired)
  async findByResetToken(token: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });
  }

  // Clear reset token
  async clearResetToken(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  // Count non-deleted users
  async countActive(): Promise<number> {
    return prisma.user.count({ where: { deletedAt: null } });
  }
}

export const userRepository = new UserRepository();
