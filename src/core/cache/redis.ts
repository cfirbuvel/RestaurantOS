import Redis from "ioredis";

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
}

export class MockRedisClient implements CacheClient {
  private store: Map<string, { value: string; expiresAt: number | null }> = new Map();
  private subscribers: Map<string, Array<(message: string) => void>> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string | null> {
    let expiresAt: number | null = null;
    if (mode === "EX" && duration) {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === "PX" && duration) {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) + 1 : 1;
    await this.set(key, num.toString());
    return num;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expiresAt) return -1;
    const diff = Math.ceil((item.expiresAt - Date.now()) / 1000);
    return diff > 0 ? diff : -2;
  }

  async publish(channel: string, message: string): Promise<number> {
    const listeners = this.subscribers.get(channel) || [];
    for (const listener of listeners) {
      try {
        listener(message);
      } catch (err) {
        console.error(`MockRedis listener error on channel ${channel}:`, err);
      }
    }
    return listeners.length;
  }

  subscribe(channel: string, callback: (message: string) => void) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel)!.push(callback);
  }

  clear() {
    this.store.clear();
    this.subscribers.clear();
  }
}

const globalForRedis = globalThis as unknown as {
  mockRedis: MockRedisClient | undefined;
};

export const mockRedis = globalForRedis.mockRedis ?? new MockRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.mockRedis = mockRedis;
}

let liveRedis: Redis | null = null;

export function getRedisClient(): CacheClient {
  if (process.env.NODE_ENV === "test" || !process.env.REDIS_URL) {
    return mockRedis;
  }

  if (!liveRedis) {
    liveRedis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }

  return liveRedis as unknown as CacheClient;
}
