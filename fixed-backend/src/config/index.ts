import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';

// Load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = join(process.cwd(), `.env.${nodeEnv}`);

// Load .env file, then .env.local, then .env
dotenvConfig({ path: envFile });
dotenvConfig({ path: join(process.cwd(), '.env.local') });
dotenvConfig({ path: join(process.cwd(), '.env') });

interface Config {
  nodeEnv: string;
  port: number | string;
  trustProxy: boolean;
  // CORS — single origin (string) or comma-separated list (array)
  corsOrigin: string | string[];
  frontendOrigin: string;
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  // Database
  databaseUrl: string;
  // Redis
  redisUrl: string | undefined;
  redisHost: string;
  redisPort: number;
  redisPassword: string | undefined;
  // JWT
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  // Cookie
  cookieSecret: string;
  cookieSecure: boolean;
  // Upload
  uploadMaxSize: string;
  uploadDir: string;
  // Email (for future)
  emailService: string;
  emailUser: string;
  emailPass: string;
  // Frontend
  frontendUrl: string;
  // External AI service
  externalDocumentServiceUrl: string;
  externalLlmServiceUrl: string;
  externalApiKey: string | undefined;
  // Google OAuth
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  // Supabase Storage
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseBucket: string;
  supabaseSignedUrlTtlSeconds: number;
}

// Parse CORS_ORIGIN / FRONTEND_ORIGIN — accept comma-separated lists for prod
// (e.g. "https://app.vercel.app,https://app-staging.vercel.app").
function parseOrigins(raw: string | undefined, fallback: string): string | string[] {
  if (!raw) return fallback;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length === 1 ? parts[0] : parts;
}

const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  trustProxy: process.env.TRUST_PROXY === 'true',
  corsOrigin: parseOrigins(
    process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN,
    'http://localhost:3001',
  ),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3001',
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  // Prefer REDIS_URL (Upstash / production TLS) over host+port+password.
  redisUrl: process.env.REDIS_URL || undefined,
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '24h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  cookieSecret: process.env.COOKIE_SECRET || 'your-cookie-secret',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  uploadMaxSize: process.env.UPLOAD_MAX_SIZE || '10mb',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  emailService: process.env.EMAIL_SERVICE || '',
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  externalDocumentServiceUrl:
    process.env.EXTERNAL_DOCUMENT_SERVICE_URL || 'http://localhost:8000',
  externalLlmServiceUrl:
    process.env.EXTERNAL_LLM_SERVICE_URL || 'http://localhost:8000',
  externalApiKey: process.env.EXTERNAL_API_KEY || undefined,
  // Google OAuth — keep fallbacks empty so missing env is loud, not silent.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:3000/api/auth/google/callback',
  // Supabase Storage — also loud if missing; uploads will hard-fail rather
  // than silently writing to local disk (which would break in production).
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseBucket: process.env.SUPABASE_BUCKET || 'uploads',
  supabaseSignedUrlTtlSeconds: parseInt(
    process.env.SUPABASE_SIGNED_URL_TTL_SECONDS || '3600',
    10,
  ),
};

export { config };