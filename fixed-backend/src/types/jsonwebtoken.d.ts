declare module 'jsonwebtoken' {
  import { SignOptions } from 'jsonwebtoken';

  interface JwtPayload {
    [key: string]: unknown;
    userId?: string;
    email?: string;
    role?: string;
    exp?: number;
    iat?: number;
  }

  export function sign(
    payload: string | object | Buffer,
    secret: string | Buffer,
    options?: SignOptions,
  ): string;

  export function verify(
    token: string,
    secret: string | Buffer,
    options?: { algorithms?: string[] },
  ): string | JwtPayload;

  export interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    issuer?: string;
    jwtid?: string;
    subject?: string;
    noTimestamp?: boolean;
    header?: object;
    encoding?: string;
    allowInsecureKeySizes?: boolean;
  }
}
