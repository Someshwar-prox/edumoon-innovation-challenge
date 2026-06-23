declare module 'compression' {
  import { RequestHandler } from 'express';

  interface CompressionOptions {
    threshold?: number | string;
    level?: number;
    chunkSize?: number;
    filter?: (req: unknown, res: unknown) => boolean;
  }

  function compression(options?: CompressionOptions): RequestHandler;

  namespace compression {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Static<T = any> = (options?: T) => RequestHandler;
  }

  export = compression;
}
