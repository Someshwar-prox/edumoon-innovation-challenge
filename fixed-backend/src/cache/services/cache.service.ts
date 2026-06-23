import { cacheRepository } from '../repositories/cache.repository';
import logger from '../../utils/logger';

// Cache service
export class CacheService {
  // Set value in cache
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await cacheRepository.set(key, value, ttl);
      logger.debug(`Cache set: ${key}` + (ttl ? ` (TTL: ${ttl}s)` : ''));
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  }

  // Get value from cache
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await cacheRepository.get<T>(key);
      logger.debug(`Cache get: ${key}` + (value ? ' (hit)' : ' (miss)'));
      return value;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      throw error;
    }
  }

  // Delete value from cache
  async del(key: string): Promise<number> {
    try {
      const result = await cacheRepository.del(key);
      logger.debug(`Cache delete: ${key} (${result} item(s) removed)`);
      return result;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      throw error;
    }
  }

  // Check if key exists in cache
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await cacheRepository.exists(key);
      logger.debug(`Cache exists: ${key} (${exists ? 'yes' : 'no'})`);
      return exists;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      throw error;
    }
  }

  // Increment numeric value in cache
  async incr(key: string): Promise<number> {
    try {
      const value = await cacheRepository.incr(key);
      logger.debug(`Cache increment: ${key} = ${value}`);
      return value;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      throw error;
    }
  }

  // Decrement numeric value in cache
  async decr(key: string): Promise<number> {
    try {
      const value = await cacheRepository.decr(key);
      logger.debug(`Cache decrement: ${key} = ${value}`);
      return value;
    } catch (error) {
      logger.error(`Cache decrement error for key ${key}:`, error);
      throw error;
    }
  }

  // Add to set in cache
  async sadd(key: string, member: string): Promise<number> {
    try {
      const result = await cacheRepository.sadd(key, member);
      logger.debug(`Cache set add: ${key} + ${member} (${result} item(s))`);
      return result;
    } catch (error) {
      logger.error(`Cache set add error for key ${key}:`, error);
      throw error;
    }
  }

  // Get set members from cache
  async smembers(key: string): Promise<string[]> {
    try {
      const members = await cacheRepository.smembers(key);
      logger.debug(`Cache set members: ${key} (${members.length} members)`);
      return members;
    } catch (error) {
      logger.error(`Cache set members error for key ${key}:`, error);
      throw error;
    }
  }

  // Add to list in cache
  async lpush(key: string, value: string): Promise<number> {
    try {
      const result = await cacheRepository.lpush(key, value);
      logger.debug(`Cache list push: ${key} <- ${value} (${result} items)`);
      return result;
    } catch (error) {
      logger.error(`Cache list push error for key ${key}:`, error);
      throw error;
    }
  }

  // Get list range from cache
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const range = await cacheRepository.lrange(key, start, stop);
      logger.debug(`Cache list range: ${key}[${start}:${stop}] (${range.length} items)`);
      return range;
    } catch (error) {
      logger.error(`Cache list range error for key ${key}:`, error);
      throw error;
    }
  }

  // Get cache info/memory usage
  async info(): Promise<string> {
    try {
      const info = await cacheRepository.info();
      logger.debug('Cache info retrieved');
      return info;
    } catch (error) {
      logger.error('Cache info error:', error);
      throw error;
    }
  }

  // Flush all cache (use with caution!)
  async flushall(): Promise<void> {
    try {
      await cacheRepository.flushall();
      logger.warn('Cache flushed completely');
    } catch (error) {
      logger.error('Cache flush error:', error);
      throw error;
    }
  }

  // Get TTL for key
  async ttl(key: string): Promise<number> {
    try {
      const ttl = await cacheRepository.ttl(key);
      logger.debug(`Cache TTL: ${key} = ${ttl}s`);
      return ttl;
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      throw error;
    }
  }

  // Convenience method to cache a function result
  async memoize<T>(key: string, fn: () => Promise<T>, ttl: number): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, execute function and store result
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }
}

// Export singleton instance
export const cacheService = new CacheService();