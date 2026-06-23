/**
 * Express-rate-limit wrapper.
 *
 * The library itself ships without first-party TypeScript types. We use
 * `require` so the file compiles whether or not `@types/express-rate-limit`
 * is installed, and we re-export the rate-limit factory with a typed
 * signature for callers.
 */
import rateLimitFn from 'express-rate-limit';

export type RateLimitRequestHandler = ReturnType<typeof rateLimitFn>;

export const rateLimit = rateLimitFn as unknown as (
  options?: Parameters<typeof rateLimitFn>[0],
) => RateLimitRequestHandler;

export default rateLimit;
