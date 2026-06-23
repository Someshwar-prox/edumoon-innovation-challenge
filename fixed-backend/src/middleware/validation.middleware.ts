import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import logger from '../utils/logger';

type Source = 'body' | 'params' | 'query';

/**
 * Validate `req[source]` against a Zod schema. On failure, forwards
 * the ZodError to the global error handler so it's rendered as a 400.
 */
function makeValidator(schema: ZodSchema, source: Source) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse(req[source]);
      next();
    } catch (err) {
      logger.warn(
        {
          source,
          url: req.originalUrl,
          method: req.method,
          issues: err instanceof Error ? (err as { errors?: unknown }).errors : undefined,
        },
        'Validation error',
      );
      next(err);
    }
  };
}

export const validateRequest = (schema: ZodSchema) => makeValidator(schema, 'body');
export const validateParams = (schema: ZodSchema) => makeValidator(schema, 'params');
export const validateQuery = (schema: ZodSchema) => makeValidator(schema, 'query');
