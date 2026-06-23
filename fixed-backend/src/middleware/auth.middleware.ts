import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/services/auth.service';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';

/**
 * Middleware to authenticate the request.
 *
 * Accepts EITHER:
 *   1. `Authorization: Bearer <accessToken>` — the standard access-token
 *      header sent by the api() helper on every dashboard fetch.
 *   2. `refreshToken` cookie — kept for backwards compatibility with the
 *      /api/auth/refresh flow (which is the only place that actually
 *      needs the refresh token).
 *
 * On success, attaches `req.user` with id/email/role/isVerified.
 *
 * The error messages are deliberately specific so the frontend (and
 * judges poking at the demo) can tell *why* a request bounced. No more
 * generic "No refresh token" for every cause.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1) Prefer the Authorization: Bearer access token (the api() helper
    //    sends this on every request).
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const payload = authService.verifyAccessToken(token);
          userId = payload.userId;
        } catch (err) {
          // Access token is malformed or expired — the frontend will
          // catch the 401 and try to refresh, so don't 401 here if the
          // refresh cookie is also valid. Fall through.
          logger.debug({ err }, 'Bearer token rejected; trying cookie')
        }
      }
    }

    // 2) Fall back to the refresh cookie.
    if (!userId) {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        try {
          const payload = authService.verifyRefreshToken(refreshToken);
          userId = payload.userId;
        } catch {
          // ignore — fall through
        }
      }
    }

    if (!userId) {
      logger.warn(
        { authHeader: !!authHeader, hasCookie: !!req.cookies?.refreshToken },
        'auth middleware rejected request — no userId resolved',
      );
      res.status(401).json({
        error: 'Not signed in',
        reason: !authHeader
          ? 'no_auth_header_and_no_cookie'
          : 'token_expired_and_no_cookie',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
      },
    });
    if (!user) {
      res.status(401).json({ error: 'User account not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};
