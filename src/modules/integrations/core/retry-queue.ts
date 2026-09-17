import crypto from "crypto";
import { memoryDb } from "@/core/database/db";

export interface RetryJob<T = any> {
  id: string;
  tenantId: string;
  provider: string;
  action: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date;
  status: "PENDING" | "RETRYING" | "COMPLETED" | "DEAD_LETTER";
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeadLetterRecord {
  id: string;
  jobId: string;
  tenantId: string;
  provider: string;
  action: string;
  payload: any;
  finalError: string;
  attemptsCount: number;
  replayed: boolean;
  replayedAt?: Date;
  createdAt: Date;
}

export class IntegrationRetryQueue {
  private static instance: IntegrationRetryQueue;
  private jobs: Map<string, RetryJob> = new Map();
  private baseDelayMs: number = 1000; // 1s
  private maxAttempts: number = 5;

  private constructor() {}

  static getInstance(): IntegrationRetryQueue {
    if (!IntegrationRetryQueue.instance) {
      IntegrationRetryQueue.instance = new IntegrationRetryQueue();
    }
    return IntegrationRetryQueue.instance;
  }

  /**
   * Configure base delay and max attempts (useful for testing)
   */
  configure(options: { baseDelayMs?: number; maxAttempts?: number }) {
    if (options.baseDelayMs !== undefined) this.baseDelayMs = options.baseDelayMs;
    if (options.maxAttempts !== undefined) this.maxAttempts = options.maxAttempts;
  }

  /**
   * Enqueue a failed operation for exponential backoff retry
   */
  enqueue<T = any>(params: {
    tenantId: string;
    provider: string;
    action: string;
    payload: T;
    error: string;
  }): RetryJob<T> {
    const id = crypto.randomUUID();
    const now = new Date();
    const delay = this.calculateDelay(1);
    const nextRunAt = new Date(now.getTime() + delay);

    const job: RetryJob<T> = {
      id,
      tenantId: params.tenantId,
      provider: params.provider,
      action: params.action,
      payload: params.payload,
      attempts: 1,
      maxAttempts: this.maxAttempts,
      nextRunAt,
      status: "PENDING",
      lastError: params.error,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);

    // Also persist in memoryDb / db table if available
    try {
      memoryDb.insert("integration_logs", {
        id: crypto.randomUUID(),
        tenant_id: params.tenantId,
        provider: params.provider,
        event_type: `${params.action}_RETRY_SCHEDULED`,
        status: "SCHEDULED",
        details: { jobId: id, attempt: 1, nextRunAt: nextRunAt.toISOString(), error: params.error },
        created_at: now.toISOString(),
      });
    } catch {
      // ignore db error
    }

    return job;
  }

  /**
   * Calculate exponential backoff delay: baseDelay * 2^(attempt - 1)
   */
  calculateDelay(attempt: number): number {
    return this.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  }

  /**
   * Record retry attempt result
   */
  async recordAttempt(
    jobId: string,
    success: boolean,
    error?: string
  ): Promise<RetryJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const now = new Date();
    job.updatedAt = now;

    if (success) {
      job.status = "COMPLETED";
      job.lastError = undefined;
      return job;
    }

    job.attempts += 1;
    job.lastError = error;

    if (job.attempts >= job.maxAttempts) {
      job.status = "DEAD_LETTER";
      this.recordDeadLetter(job, error || "Max retry attempts exceeded");
    } else {
      job.status = "RETRYING";
      const delay = this.calculateDelay(job.attempts);
      job.nextRunAt = new Date(now.getTime() + delay);
    }

    return job;
  }

  /**
   * Route failed job to dead-letter queue
   */
  recordDeadLetter(job: RetryJob, reason: string): DeadLetterRecord {
    const deadLetterId = crypto.randomUUID();
    const record: DeadLetterRecord = {
      id: deadLetterId,
      jobId: job.id,
      tenantId: job.tenantId,
      provider: job.provider,
      action: job.action,
      payload: job.payload,
      finalError: reason,
      attemptsCount: job.attempts,
      replayed: false,
      createdAt: new Date(),
    };

    memoryDb.insert("integration_dead_letters", {
      ...record,
      created_at: record.createdAt.toISOString(),
    });

    return record;
  }

  /**
   * Get all dead letter records
   */
  getDeadLetters(tenantId?: string): DeadLetterRecord[] {
    const table = memoryDb.getTable("integration_dead_letters");
    const records: DeadLetterRecord[] = [];
    for (const item of table.values()) {
      if (!tenantId || item.tenantId === tenantId) {
        records.push(item);
      }
    }
    return records;
  }

  /**
   * Replay a dead-letter job
   */
  async replayDeadLetter(
    deadLetterId: string,
    handler: (payload: any) => Promise<boolean>
  ): Promise<{ success: boolean; error?: string }> {
    const table = memoryDb.getTable("integration_dead_letters");
    const item = table.get(deadLetterId);
    if (!item) {
      return { success: false, error: "Dead letter record not found" };
    }

    try {
      const result = await handler(item.payload);
      if (result) {
        item.replayed = true;
        item.replayedAt = new Date().toISOString();
        table.set(deadLetterId, item);
        return { success: true };
      }
      return { success: false, error: "Handler returned failure" };
    } catch (err: any) {
      return { success: false, error: err.message || "Replay failed" };
    }
  }

  getJob(jobId: string): RetryJob | undefined {
    return this.jobs.get(jobId);
  }

  reset() {
    this.jobs.clear();
  }
}

export const integrationRetryQueue = IntegrationRetryQueue.getInstance();
