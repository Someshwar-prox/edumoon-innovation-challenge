import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface UserContext {
      requestId?: string;
      correlationId?: string;
      startedAt?: number;
    }

    interface Request {
      user?: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        role: Role;
        isVerified?: boolean;
      };
      context?: UserContext;
    }
  }
}

export {};
