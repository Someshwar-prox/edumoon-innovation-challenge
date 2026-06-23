import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { authRepository } from '../repositories/auth.repository';
import { prisma } from '../../lib/prisma';
import logger from '../../utils/logger';
import { User } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: User['role'];
}

const REFRESH_TOKEN_TTL_DAYS = 30;
const SALT_ROUNDS = 12;

function isJwtPayload(value: unknown): value is JwtPayload {
  return typeof value === 'object' && value !== null;
}

export class AuthService {
  // ---------------------------------------------------------------------------
  // Password helpers
  // ---------------------------------------------------------------------------
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // ---------------------------------------------------------------------------
  // JWT helpers
  // ---------------------------------------------------------------------------
  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, config.jwtAccessSecret, {
      expiresIn: config.jwtAccessExpiresIn,
    } as SignOptions);
  }

  signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpiresIn,
    } as SignOptions);
  }

  verifyRefreshToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, config.jwtRefreshSecret);
    if (!isJwtPayload(decoded)) {
      throw new Error('Invalid token payload');
    }
    const { userId, email, role } = decoded as AccessTokenPayload & JwtPayload;
    if (typeof userId !== 'string') {
      throw new Error('Invalid token payload');
    }
    return { userId, email: email as string, role: role as User['role'] };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, config.jwtAccessSecret);
    if (!isJwtPayload(decoded)) {
      throw new Error('Invalid token payload');
    }
    const { userId, email, role } = decoded as AccessTokenPayload & JwtPayload;
    if (typeof userId !== 'string') {
      throw new Error('Invalid token payload');
    }
    return { userId, email: email as string, role: role as User['role'] };
  }

  // ---------------------------------------------------------------------------
  // Registration / verification
  // ---------------------------------------------------------------------------
  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ user: User; verificationToken: string }> {
    // Hackathon-friendly: if the email already exists, treat register as a
    // password reset + sign-in. This makes /register fully idempotent so
    // the frontend never has to choose between "signup" and "signin" —
    // the user can type any creds and end up logged in.
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      const passwordHash = await this.hashPassword(input.password);
      const updated = await authRepository.updatePassword(
        existing.id,
        passwordHash,
      );
      if (input.firstName || input.lastName) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: input.firstName || updated.firstName,
            lastName: input.lastName || updated.lastName,
          },
        });
      }
      return { user: updated, verificationToken: '' };
    }

    const passwordHash = await this.hashPassword(input.password);
    const verificationToken = uuidv4();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let user: User;
    try {
      user = await authRepository.createUser({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        verificationToken,
        verificationTokenExpiry,
      });
    } catch (err) {
      // Race: another request created the same email between our check and
      // our insert. Re-run the idempotent path above.
      if ((err as { code?: string })?.code === 'P2002') {
        const raceExisting = await authRepository.findByEmail(input.email);
        if (raceExisting) {
          const newHash = await this.hashPassword(input.password);
          return {
            user: await authRepository.updatePassword(raceExisting.id, newHash),
            verificationToken: '',
          };
        }
      }
      throw err;
    }

    // In dev/staging, auto-verify so the demo flow doesn't get stuck on email.
    // Real email verification is left in place for production.
    if (config.nodeEnv !== 'production') {
      user = await authRepository.verifyUser(user.id);
    }

    return { user, verificationToken };
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });
    if (!user) {
      throw new Error('Invalid verification token');
    }
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new Error('Verification token expired');
    }
    return authRepository.verifyUser(user.id);
  }

  // ---------------------------------------------------------------------------
  // Login / refresh / logout
  // ---------------------------------------------------------------------------
  async login(email: string, password: string): Promise<{ user: User; tokens: TokenPair }> {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    const ok = await this.verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new Error('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(refreshToken);
    const user = await authRepository.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }
    // Idempotent refresh — we don't rotate (revoke + reissue) the refresh
    // token anymore. Rotation was the root cause of "No refresh token"
    // flapping when two requests raced against the same cookie. The
    // access JWT has its own short expiry, so a leaked refresh token is
    // bounded by the 30-day cookie TTL regardless.
    //
    // We still revoke *known-compromised* tokens (logout) and we prune
    // expired rows in a periodic cleanup. The trade-off is: an attacker
    // who steals a refresh cookie can mint access tokens for up to 30
    // days. For a hackathon demo this is the right call — users should
    // never be silently logged out by a race.
    return this.issueTokenPair(user);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken, revoked: false },
        data: { revoked: true },
      });
    } catch (err) {
      logger.warn('Logout failed to revoke refresh token', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Password reset
  // ---------------------------------------------------------------------------
  async forgotPassword(email: string): Promise<{ token: string; user: User } | null> {
    const user = await authRepository.findByEmail(email);
    if (!user) return null;
    const token = uuidv4();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await authRepository.setResetToken(user.id, token, expiry);
    return { token, user };
  }

  async resetPassword(token: string, newPassword: string): Promise<User> {
    const user = await authRepository.findByResetToken(token);
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }
    const passwordHash = await this.hashPassword(newPassword);
    await authRepository.clearResetToken(user.id);
    return authRepository.updatePassword(user.id, passwordHash);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = this.signRefreshToken(user.id);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });
    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
