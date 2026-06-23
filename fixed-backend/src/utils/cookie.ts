import { Response } from 'express';

/**
 * Set cookie with consistent options
 * @param res - Express response object
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 */
export function setCookie(
  res: Response,
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: boolean | 'lax' | 'strict' | 'none';
    maxAge?: number; // in milliseconds
    path?: string;
    domain?: string;
    signed?: boolean;
  } = {}
) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    ...options
  };

  res.cookie(name, value, cookieOptions);
}