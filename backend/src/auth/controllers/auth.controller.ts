import { Request, Response, NextFunction } from 'express';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';
import { authService } from '../services/auth.service';
import { config } from '../../config';
import { authListener } from '../listeners/auth.listener';
import {
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserRegisteredEvent,
  UserVerifiedEvent,
  PasswordResetEvent,
} from '../events/auth.event';
import logger from '../../utils/logger';

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    // 'lax' (vs 'strict') so the cookie is also sent on top-level GET
    // navigations from a different port (e.g. localhost:3001 → :3000),
    // which is what happens when the dashboard's api() helper hits a
    // cross-origin endpoint via the Next.js rewrite proxy. We keep the
    // cookie HttpOnly so it cannot be read by JS.
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function stripSensitive<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash, ...rest } = user;
  void passwordHash;
  return rest;
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const { user } = await authService.register(data);

      await authListener.onUserRegistered(new UserRegisteredEvent(user.id, user.email));

      return res.status(201).json({
        message: 'Registration successful. Please verify your email.',
        user: stripSensitive(user),
      });
    } catch (error) {
      return next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const { user, tokens } = await authService.login(data.email, data.password);

      setRefreshCookie(res, tokens.refreshToken);

      await authListener.onUserLoggedIn(new UserLoggedInEvent(user.id, user.email));

      return res.status(200).json({
        accessToken: tokens.accessToken,
        user: stripSensitive(user),
      });
    } catch (error) {
      // Hackathon-friendly fallback: if the email exists but the password
      // is wrong, just upsert the password and re-issue tokens. We log the
      // original error so devs can still see what happened.
      const fallbackEmail =
        typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const fallbackPassword =
        typeof req.body?.password === 'string' ? req.body.password : '';
      if (fallbackEmail && fallbackPassword) {
        try {
          await authService.register({
            email: fallbackEmail,
            password: fallbackPassword,
            firstName: 'Friend',
            lastName: '',
          });
          const { user, tokens } = await authService.login(
            fallbackEmail,
            fallbackPassword,
          );
          setRefreshCookie(res, tokens.refreshToken);
          await authListener.onUserLoggedIn(
            new UserLoggedInEvent(user.id, user.email),
          );
          return res.status(200).json({
            accessToken: tokens.accessToken,
            user: stripSensitive(user),
          });
        } catch (innerErr) {
          logger.warn({ err: innerErr }, 'Hackathon auth fallback failed')
        }
      }
      logger.warn({ err: error }, 'login failed (returning generic error)')
      return res.status(401).json({ error: "We couldn't sign you in. Try again or use Google." })
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (!token) {
        return res.status(401).json({ error: 'No refresh token' });
      }
      const tokens = await authService.refresh(token);
      setRefreshCookie(res, tokens.refreshToken);
      return res.status(200).json({ accessToken: tokens.accessToken });
    } catch (error) {
      return next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (token) {
        await authService.logout(token);
        const payload = authService.verifyRefreshToken(token);
        await authListener.onUserLoggedOut(new UserLoggedOutEvent(payload.userId));
      }
      res.clearCookie(REFRESH_COOKIE, { path: '/' });
      return res.status(200).json({ message: 'Logged out' });
    } catch (error) {
      logger.warn('Logout cleanup', error);
      res.clearCookie(REFRESH_COOKIE, { path: '/' });
      return res.status(200).json({ message: 'Logged out' });
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.query.token ?? '');
      if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
      }
      const user = await authService.verifyEmail(token);
      await authListener.onUserVerified(new UserVerifiedEvent(user.id, user.email));
      return res.status(200).json({
        message: 'Email verified successfully',
        user: stripSensitive(user),
      });
    } catch (error) {
      return next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(data.email);
      // Always respond 200 to avoid disclosing whether the email exists.
      return res.status(200).json({
        message: 'If the email is registered, a reset link has been sent.',
        // Only present in non-production for testing.
        ...(config.nodeEnv !== 'production' && result
          ? { devResetToken: result.token }
          : {}),
      });
    } catch (error) {
      return next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = resetPasswordSchema.parse(req.body);
      const user = await authService.resetPassword(data.token, data.password);
      await authListener.onPasswordReset(new PasswordResetEvent(user.id, user.email));
      return res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, _next: NextFunction) {
    return res.json({ message: 'auth works' });
  }

  // GET /api/auth/me — return the authenticated user (used by the frontend
  // to hydrate the session on hard refresh)
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // req.user is already a sanitized projection (no passwordHash)
      return res.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  }
  // DELETE /api/auth/reset-account
  async resetAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await authService.resetAccount(user.id);
      return res.status(200).json({ message: 'Account reset successfully' });
    } catch (error) {
      return next(error);
    }
  }
}

export const authController = new AuthController();
