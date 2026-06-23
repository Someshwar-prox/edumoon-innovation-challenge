// Optional authentication middleware — never blocks, just populates
// req.user if a valid Bearer token is present. Used on routes that are
// publicly accessible (so the /<slug> embeddable route can work
// anonymously) but that benefit from knowing the user when one IS
// signed in (so businessId can be resolved from req.user).

import { NextFunction, Request, Response } from 'express';
import { authService } from '../auth/services/auth.service';
import { prisma } from '../lib/prisma';

export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return next();
    }
    const token = authHeader.slice(7).trim();
    if (!token) return next();
    let userId: string | null = null;
    try {
      const payload = authService.verifyAccessToken(token);
      userId = payload.userId;
    } catch {
      return next(); // invalid / expired — treat as anonymous
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
    if (user) {
      req.user = user;
    }
    next();
  } catch {
    next(); // never block — public routes must always succeed
  }
};