import { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/health.service';
import logger from '../../utils/logger';

export class HealthController {
  async check(_req: Request, res: Response, _next: NextFunction) {
    try {
      const result = await healthService.performHealthCheck();
      const statusCode = result.status === 'unhealthy' ? 503 : 200;
      return res.status(statusCode).json(result);
    } catch (error) {
      logger.error('Health check failed', error);
      return res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor(process.uptime()),
        checks: {},
      });
    }
  }

  async history(_req: Request, res: Response, next: NextFunction) {
    try {
      const history = await healthService.getHealthCheckHistory();
      return res.status(200).json({ history });
    } catch (error) {
      return next(error);
    }
  }

  async latest(_req: Request, res: Response, next: NextFunction) {
    try {
      const latest = await healthService.getLatestHealthCheck();
      if (!latest) {
        return res.status(404).json({ error: 'No health check history available' });
      }
      return res.status(200).json(latest);
    } catch (error) {
      return next(error);
    }
  }
}

export const healthController = new HealthController();
