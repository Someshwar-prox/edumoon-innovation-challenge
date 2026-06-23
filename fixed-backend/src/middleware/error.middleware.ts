import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../utils/logger';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const error = new HttpError(404, `Route ${req.originalUrl} not found`);
  next(error);
};

interface ErrorWithMeta {
  status?: number;
  code?: string;
  message?: string;
  stack?: string;
}

export const errorHandler = (
  error: ErrorWithMeta,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error(
    {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      body: req.body,
      query: req.query,
      params: req.params,
    },
    'Unhandled error',
  );

  // Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Prisma errors
  if (error.code === 'P2002') {
    res.status(409).json({
      error: 'Conflict',
      message: 'A record with these values already exists',
    });
    return;
  }
  if (error.code === 'P2025') {
    res.status(404).json({
      error: 'Not found',
      message: 'The requested resource was not found',
    });
    return;
  }

  const status = error.status ?? 500;
  const message = error.message ?? 'Internal Server Error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && error.stack ? { stack: error.stack } : {}),
  });
};
