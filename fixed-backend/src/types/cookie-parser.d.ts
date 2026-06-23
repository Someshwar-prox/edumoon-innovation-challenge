declare module 'cookie-parser' {
  import { RequestHandler } from 'express';

  interface CookieParseOptions {
    decode?: (val: string) => string;
  }

  function cookieParser(secret?: string | string[], options?: CookieParseOptions): RequestHandler;

  namespace cookieParser {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Static<T = any> = (secret?: string | string[], options?: T) => RequestHandler;
  }

  export = cookieParser;
}
