import { getRedisClient } from "../cache/redis";

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export class RateLimiter {
  async check(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    const redis = getRedisClient();
    const redisKey = `ratelimit:${key}`;

    const currentCount = await redis.incr(redisKey);

    if (currentCount === 1) {
      await redis.expire(redisKey, options.windowSeconds);
    }

    const ttl = await redis.ttl(redisKey);
    const resetTime = Date.now() + Math.max(0, ttl) * 1000;
    const remaining = Math.max(0, options.maxRequests - currentCount);

    return {
      allowed: currentCount <= options.maxRequests,
      remaining,
      resetTime,
    };
  }
}

export const rateLimiter = new RateLimiter();
