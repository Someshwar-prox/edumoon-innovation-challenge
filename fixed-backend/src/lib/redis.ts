import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// ioredis only accepts a connection string as the first positional argument;
// spreading { url, host, port, password } into the options object fails with
// ECONNREFUSED because the URL gets ignored. So branch on which form to use.
const redis = config.redisUrl
  ? new Redis(config.redisUrl, {
      db: 0,
      keyPrefix: 'aibridge:',
      connectTimeout: 8000,
      maxRetriesPerRequest: 3,
      family: 0, // 0 = try IPv4 then IPv6 — Upstash resolves both
    })
  : new Redis({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
      db: 0,
      keyPrefix: 'aibridge:',
      connectTimeout: 8000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => err.message.includes('READONLY'),
    });

redis.on('connect', () => logger.info('Connected to Redis'));
redis.on('ready', () => logger.info('Redis ready'));
redis.on('error', (err) => logger.error('Redis error:', err));
redis.on('close', () => logger.warn('Redis connection closed'));
redis.on('reconnecting', () => logger.info('Reconnecting to Redis...'));

process.on('SIGINT', async () => {
  logger.info('Closing Redis connection...');
  await redis.quit();
  process.exit(0);
});

export { redis };
export default redis;