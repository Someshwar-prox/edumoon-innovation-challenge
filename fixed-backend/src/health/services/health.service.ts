import { redis } from '../../lib/redis';
import logger from '../../utils/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, { status: 'healthy' | 'unhealthy'; message?: string; responseTime?: number }>;
}

// Health service — performs live liveness probes against Postgres and Redis.
export class HealthService {
  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const version = process.env.npm_package_version || '1.0.0';

    const [database, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const checks = { database, redis: redisCheck };
    const status: HealthCheckResult['status'] =
      database.status === 'unhealthy' || redisCheck.status === 'unhealthy'
        ? 'unhealthy'
        : 'healthy';

    return {
      status,
      timestamp,
      version,
      uptime: Math.floor(process.uptime()),
      checks,
    };
  }

  async getHealthCheckHistory(): Promise<HealthCheckResult[]> {
    // No persistent storage yet — return empty array so the endpoint is wired.
    return [];
  }

  async getLatestHealthCheck(): Promise<HealthCheckResult | null> {
    // No persistent storage yet — return null.
    return null;
  }

  // ---------------------------------------------------------------------------
  private async checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; message?: string; responseTime?: number }> {
    const start = Date.now();
    try {
      const { prisma } = await import('../../lib/prisma');
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', message: 'Database connection OK', responseTime: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Database health check failed', error);
      return { status: 'unhealthy', message, responseTime: Date.now() - start };
    }
  }

  private async checkRedis(): Promise<{ status: 'healthy' | 'unhealthy'; message?: string; responseTime?: number }> {
    const start = Date.now();
    try {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected PING response: ${pong}`);
      }
      return { status: 'healthy', message: 'Redis connection OK', responseTime: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Redis health check failed', error);
      return { status: 'unhealthy', message, responseTime: Date.now() - start };
    }
  }
}

export const healthService = new HealthService();
