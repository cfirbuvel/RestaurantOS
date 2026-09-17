/**
 * In-Memory Sliding Window Rate Limiter for Public Ordering & Cart Endpoints
 */

interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every 5 minutes to prevent memory leak
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Check if a request is allowed under rate limiting rules
   * @param key IP address or client fingerprint identifier
   * @param maxRequests Maximum requests permitted within the window
   * @param windowMs Time window in milliseconds (default 60,000ms = 1 min)
   */
  check(
    key: string,
    maxRequests: number = 60,
    windowMs: number = 60000
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filter out timestamps outside current window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= maxRequests) {
      const oldestInWindow = record.timestamps[0] || now;
      const resetTime = oldestInWindow + windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: maxRequests - record.timestamps.length,
      resetTime: now + windowMs,
    };
  }

  /**
   * Reset rate limiter for testing
   */
  reset(): void {
    this.records.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const threshold = now - 10 * 60 * 1000; // 10 minutes ago
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > threshold);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
}

export const publicRateLimiter = new RateLimiter();
