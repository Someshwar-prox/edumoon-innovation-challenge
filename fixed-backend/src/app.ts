import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { json, urlencoded } from 'body-parser';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request.middleware';

// Import routes
import authRoutes from './auth/routes';
import { googleAuthController } from './auth/controllers/google-auth.controller';
import usersRoutes from './users/routes';
import businessRoutes from './business/routes';
import businessSettingsRoutes from './business-settings/routes';
import documentsRoutes from './documents/routes';
import websiteRoutes from './website/routes';
import knowledgeBaseRoutes from './knowledge-base/routes';
import auditRoutes from './audit/routes';
import chatRoutes from './chat/routes';
import widgetRoutes from './widget/routes';
import analyticsRoutes from './analytics/routes';
import notificationsRoutes from './notifications/routes';
import syncRoutes from './sync/routes';
import jobsRoutes from './jobs/routes';
import healthRoutes from './health/routes';

const app: Express = express();

// Trust proxy if behind load balancer
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https:'],
      connectSrc: ["'self'", 'https:'],
      frameSrc: ["'self'"],
    }
  }
}));

// CORS middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Compression middleware
app.use(compression());

// Body parsers
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting — only applied to /api/* (skip the Next.js rewrites
// for static assets / pages). Without `skip:` we were counting the
// frontend's 1.2s poll of /api/chat/{sid}/messages toward the
// 100-request-per-15min budget, so a single chat hit the wall after
// ~80s of polling. The default message is replaced with a friendlier
// phrasing and `keyGenerator` returns the IP so we don't accidentally
// bucket two users behind the same NAT.
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs || 900000, // 15 minutes
  max: config.rateLimitMax || 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // The polling client shouldn't be throttled for the same chat
  // session; treat /api/chat/{sid}/messages GETs as cheap reads and
  // /api/auth/refresh POSTs as idempotent. Both get a 5× allowance.
  skip: (req) =>
    (req.method === 'GET' && /^\/api\/chat\/[^/]+\/messages$/.test(req.originalUrl)) ||
    (req.method === 'POST' && req.originalUrl === '/api/auth/refresh'),
  message: {
    error: 'Too many requests, please try again later.',
  },
});

// Health and the /api/auth/google/* redirect path MUST NOT count
// against the limit. We mount the limiter only on /api/* so this is
// implicit (no app.use(limiter) at the top level), but be explicit in
// case someone reorders the middleware later.
app.use('/api', apiLimiter);

// Request logging middleware
app.use(requestLogger);

// DEBUG: log req.user for /api/* requests so we can confirm auth
// middleware set the user before the route handler ran.
app.use('/api', (req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(
    '[app-debug]', req.method, req.originalUrl,
    'user=', (req as any).user?.id ?? null,
    'authHeader=', !!req.headers.authorization,
  );
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
// Google OAuth — server-side redirect flow (preferred for the web app)
app.get(
  '/api/auth/google/start',
  googleAuthController.startGoogleOAuth,
);
app.get(
  '/api/auth/google/callback',
  googleAuthController.googleOAuthCallback,
);
// Google OAuth — POST /api/auth/google with { credential: <id_token> }
// (legacy GIS popup flow, still works for the mobile app if we add one)
app.post('/api/auth/google', googleAuthController.signInWithGoogle);
app.use('/api/users', usersRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/business-settings', businessSettingsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/jobs', jobsRoutes);

// Health checks
app.use('/health', healthRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;