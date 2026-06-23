import { redis } from '../../lib/redis';

// Cache repository wrapper around Redis
export class CacheRepository {
  // Set value in cache
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const prefixedKey = `aibridge:${key}`;
    if (ttl && ttl > 0) {
      await redis.setex(prefixedKey, ttl, JSON.stringify(value));
    } else {
      await redis.set(prefixedKey, JSON.stringify(value));
    }
  }

  // Get value from cache
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = `aibridge:${key}`;
    const value = await redis.get(prefixedKey);
    return value ? JSON.parse(value) : null;
  }

  // Delete value from cache
  async del(key: string): Promise<number> {
    const prefixedKey = `aibridge:${key}`;
    return redis.del(prefixedKey);
  }

  // Check if key exists in cache
  async exists(key: string): Promise<boolean> {
    const prefixedKey = `aibridge:${key}`;
    const result = await redis.exists(prefixedKey);
    return result === 1;
  }

  // Increment numeric value in cache
  async incr(key: string): Promise<number> {
    const prefixedKey = `aibridge:${key}`;
    return redis.incr(prefixedKey);
  }

  // Decrement numeric value in cache
  async decr(key: string): Promise<number> {
    const prefixedKey = `aibridge:${key}`;
    return redis.decr(prefixedKey);
  }

  // Add to set in cache
  async sadd(key: string, member: string): Promise<number> {
    const prefixedKey = `aibridge:${key}`;
    return redis.sadd(prefixedKey, member);
  }

  // Get set members from cache
  async smembers(key: string): Promise<string[]> {
    const prefixedKey = `aibridge:${key}`;
    return redis.smembers(prefixedKey);
  }

  // Add to list in cache
  async lpush(key: string, value: string): Promise<number> {
    const prefixedKey = `aibridge:${key}`;
    return redis.lpush(prefixedKey, value);
  }

  // Get list range from cache
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const prefixedKey = `aibridge:${key}`;
    return redis.lrange(prefixedKey, start, stop);
  }

  // Get cache info/memory usage
  async info(): Promise<string> {
    return redis.info();
  }

  // Flush all cache (use with caution!)
  async flushall(): Promise<void> {
    await redis.flushall();
  }

  // Get TTL for key
  async ttl(key: string): Promise<number> {
    const prefixedKey = `aibridge:${key}`;
    return redis.ttl(prefixedKey);
  }
}

// Export singleton instance
export const cacheRepository = new CacheRepository();