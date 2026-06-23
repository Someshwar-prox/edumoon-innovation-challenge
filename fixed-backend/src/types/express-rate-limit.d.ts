declare module 'express-rate-limit' {
  import { Request, Response, RequestHandler } from 'express';

  interface RateLimitOptions {
    windowMs?: number;
    max?: number | ((req: Request, res: Response) => number);
    message?: string | object | ((req: Request, res: Response) => string | object);
    statusCode?: number;
    legacyHeaders?: boolean;
    standardHeaders?: boolean;
    store?: unknown;
    keyGenerator?: (req: Request, res: Response) => string;
    skip?: (req: Request, res: Response) => boolean;
    handler?: (req: Request, res: Response, next: (err?: unknown) => void, options: { windowMs: number; max: number }) => void;
    requestPropertyName?: string;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    requestWasSuccessful?: (req: Request, res: Response) => boolean;
  }

  function rateLimit(options?: RateLimitOptions): RequestHandler;
  export = rateLimit;
}
