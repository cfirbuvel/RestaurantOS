import { memoryDb, getPostgresPool } from "../database/db";
import { getRedisClient } from "../cache/redis";

export interface OutboxProcessorOptions {
  batchSize?: number;
  maxRetries?: number;
}

export class OutboxProcessor {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private batchSize: number;
  private maxRetries: number;

  constructor(options?: OutboxProcessorOptions) {
    this.batchSize = options?.batchSize || 50;
    this.maxRetries = options?.maxRetries || 5;
  }

  async processBatch(): Promise<number> {
    const redis = getRedisClient();
    let processedCount = 0;

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const unpublished = memoryDb.find(
        "outbox_events",
        (event) => !event.published && event.retry_count < this.maxRetries
      ).slice(0, this.batchSize);

      for (const item of unpublished) {
        try {
          const channel = `events:${item.tenant_id}:${item.event_type}`;
          await redis.publish(channel, JSON.stringify(item));

          memoryDb.update("outbox_events", item.id, {
            published: true,
            published_at: new Date(),
          });
          processedCount++;
        } catch (error: any) {
          memoryDb.update("outbox_events", item.id, {
            retry_count: item.retry_count + 1,
            last_error: error?.message || "Relay failure",
          });
        }
      }
      return processedCount;
    }

    const pool = getPostgresPool();
    const { rows } = await pool.query(
      `SELECT * FROM outbox_events 
       WHERE published = false AND retry_count < $1 
       ORDER BY created_at ASC 
       LIMIT $2`,
      [this.maxRetries, this.batchSize]
    );

    for (const item of rows) {
      try {
        const channel = `events:${item.tenant_id}:${item.event_type}`;
        await redis.publish(channel, JSON.stringify(item));

        await pool.query(
          `UPDATE outbox_events 
           SET published = true, published_at = NOW() 
           WHERE id = $1`,
          [item.id]
        );
        processedCount++;
      } catch (error: any) {
        await pool.query(
          `UPDATE outbox_events 
           SET retry_count = retry_count + 1, last_error = $2 
           WHERE id = $1`,
          [item.id, error?.message || "Relay failure"]
        );
      }
    }

    return processedCount;
  }

  start(intervalMs: number = 2000) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (err) {
        console.error("Outbox processing error:", err);
      }
    }, intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const outboxProcessor = new OutboxProcessor();
