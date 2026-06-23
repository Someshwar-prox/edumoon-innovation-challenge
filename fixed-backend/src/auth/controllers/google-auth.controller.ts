// Google OAuth handler.
//
// Two flows are supported:
//   1) GIS popup (existing) — POST /api/auth/google  { credential: <id_token> }
//   2) Server-side redirect — GET /api/auth/google/start
//                              GET /api/auth/google/callback?code=…&state=…
//
// Flow 2 is the recommended path for the web app: the user clicks
// "Continue with Google", is bounced to Google's consent screen, and lands
// back on the gateway, which exchanges the auth code, upserts the user,
// and 302s into the Next.js dashboard with HTTP-only cookies set.
import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config';
import { prisma } from '../../lib/prisma';
import { authRepository } from '../repositories/auth.repository';
import { authService } from '../services/auth.service';
import { User } from '@prisma/client';
import logger from '../../utils/logger';

const REFRESH_COOKIE = 'refreshToken';
const STATE_COOKIE = 'googleOauthState';

function getClient(): OAuth2Client {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in the backend env',
    );
  }
  return new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function publicUser(u: User) {
  const { passwordHash: _omit, verificationToken: _t, resetToken: _r, ...rest } = u;
  void _omit;
  void _t;
  void _r;
  return rest;
}

interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  googleSub: string;
}

async function verifyIdToken(credential: string): Promise<GoogleProfile> {
  // Build a per-call client (config may be empty in tests).
  const client = new OAuth2Client(config.googleClientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: config.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Google token missing email claim');
  }
  if (!payload.email_verified) {
    throw new Error('Google email is not verified');
  }
  return {
    email: payload.email,
    firstName: payload.given_name ?? payload.name?.split(' ')[0] ?? 'User',
    lastName: payload.family_name ?? payload.name?.split(' ').slice(1).join(' ') ?? '',
    avatarUrl: payload.picture,
    googleSub: payload.sub,
  };
}

async function upsertGoogleUser(profile: GoogleProfile): Promise<User> {
  let user = await authRepository.findByEmail(profile.email);
  if (!user) {
    // First-time Google sign-in: create a user without a real password.
    // Random password hash (bcrypt) so the row never has a usable password.
    const passwordHash = await authService.hashPassword(
      `google-oauth:${profile.googleSub}:${Date.now()}`,
    );
    user = await authRepository.createUser({
      email: profile.email,
      passwordHash,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
  }
  if (!user.isVerified) {
    user = await authRepository.verifyUser(user.id);
  }
  return user;
}

async function issueSession(
  res: Response,
  user: User,
): Promise<{ accessToken: string }> {
  const accessToken = authService.signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = authService.signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

export class GoogleAuthController {
  // -------------------------------------------------------------------------
  // Flow 1 — GIS popup (POST { credential })
  // -------------------------------------------------------------------------
  async signInWithGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const credential: string | undefined = req.body?.credential;
      if (!credential) {
        return res.status(400).json({ error: 'Missing Google credential' });
      }
      const profile = await verifyIdToken(credential);
      const user = await upsertGoogleUser(profile);
      const { accessToken } = await issueSession(res, user);
      return res.status(200).json({ accessToken, user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Flow 2 — server-side redirect (preferred for the web app)
  // -------------------------------------------------------------------------

  // GET /api/auth/google/start
  // Generates a CSRF state, stashes it in an http-only cookie, and 302s to
  // Google's consent screen.
  startGoogleOAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const client = getClient();
      const state =
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2);
      // Stash state for ~10 min; clear once consumed.
      res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60 * 1000,
      });
      const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: ['openid', 'email', 'profile'],
        state,
        prompt: 'select_account',
      });
      return res.redirect(url);
    } catch (err) {
      return next(err);
    }
  }

  // GET /api/auth/google/callback?code=…&state=…
  // Exchanges the code, verifies the id_token, upserts the user, then 302s
  // the browser to the Next.js dashboard with the access token in the URL
  // hash (frontend stores it in memory; refresh token lives in the cookie).
  async googleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      const expectedState = req.cookies?.[STATE_COOKIE];

      if (!code || !state || !expectedState || state !== expectedState) {
        return res
          .status(400)
          .send('OAuth state mismatch — please retry sign-in.');
      }
      // One-shot state — clear immediately.
      res.clearCookie(STATE_COOKIE, { path: '/' });

      const client = getClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new Error('Google did not return an id_token');
      }
      const profile = await verifyIdToken(tokens.id_token);
      const user = await upsertGoogleUser(profile);
      const { accessToken } = await issueSession(res, user);

      // Land on the dashboard with the access token in the URL hash. The
      // dashboard reads it once, stashes it in memory, then strips it from
      // history so it isn't visible in the address bar after refresh.
      const displayName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
      const dest = new URL('/dashboard', config.frontendUrl);
      dest.hash = [
        `access_token=${encodeURIComponent(accessToken)}`,
        `user_id=${encodeURIComponent(user.id)}`,
        `name=${encodeURIComponent(displayName)}`,
        `email=${encodeURIComponent(user.email)}`,
        profile.avatarUrl ? `avatar=${encodeURIComponent(profile.avatarUrl)}` : '',
      ]
        .filter(Boolean)
        .join('&');
      return res.redirect(dest.toString());
    } catch (err) {
      logger.error('Google OAuth callback failed', err);
      const dest = new URL('/signin', config.frontendUrl);
      dest.searchParams.set('error', 'google_oauth_failed');
      return res.redirect(dest.toString());
    }
  }
}

export const googleAuthController = new GoogleAuthController();