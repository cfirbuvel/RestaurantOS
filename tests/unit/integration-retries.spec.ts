import { describe, it, expect, beforeEach } from "vitest";
import { integrationRetryQueue } from "@/modules/integrations/core/retry-queue";
import { memoryDb } from "@/core/database/db";

describe("Integration Retry Queue & Dead-Letter Handling", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";

  beforeEach(() => {
    memoryDb.reset();
    integrationRetryQueue.reset();
    integrationRetryQueue.configure({ baseDelayMs: 10, maxAttempts: 3 });
  });

  it("calculates exponential backoff delay correctly", () => {
    // baseDelay = 10ms
    expect(integrationRetryQueue.calculateDelay(1)).toBe(10); // 10 * 2^0
    expect(integrationRetryQueue.calculateDelay(2)).toBe(20); // 10 * 2^1
    expect(integrationRetryQueue.calculateDelay(3)).toBe(40); // 10 * 2^2
    expect(integrationRetryQueue.calculateDelay(4)).toBe(80); // 10 * 2^3
  });

  it("enqueues failed operation and transitions through retry attempts", async () => {
    const job = integrationRetryQueue.enqueue({
      tenantId,
      provider: "GREEN_INVOICE",
      action: "ISSUE_TAX_INVOICE",
      payload: { invoiceNumber: "inv-101", amount: 150 },
      error: "Connection timeout",
    });

    expect(job.status).toBe("PENDING");
    expect(job.attempts).toBe(1);

    // Attempt 2: still fails
    const jobAttempt2 = await integrationRetryQueue.recordAttempt(job.id, false, "503 Service Unavailable");
    expect(jobAttempt2?.status).toBe("RETRYING");
    expect(jobAttempt2?.attempts).toBe(2);

    // Attempt 3: reaches max attempts (3) -> moves to DEAD_LETTER
    const jobAttempt3 = await integrationRetryQueue.recordAttempt(job.id, false, "Gateway Timeout");
    expect(jobAttempt3?.status).toBe("DEAD_LETTER");
    expect(jobAttempt3?.attempts).toBe(3);

    // Verify it is recorded in Dead Letters
    const deadLetters = integrationRetryQueue.getDeadLetters(tenantId);
    expect(deadLetters.length).toBe(1);
    expect(deadLetters[0].jobId).toBe(job.id);
    expect(deadLetters[0].provider).toBe("GREEN_INVOICE");
    expect(deadLetters[0].finalError).toBe("Gateway Timeout");
  });

  it("replays dead-letter job successfully", async () => {
    const job = integrationRetryQueue.enqueue({
      tenantId,
      provider: "WOLT",
      action: "UPDATE_STATUS",
      payload: { externalOrderId: "wolt-99", status: "READY" },
      error: "Network drop",
    });

    // Push to dead-letter
    await integrationRetryQueue.recordAttempt(job.id, false, "Err 1");
    await integrationRetryQueue.recordAttempt(job.id, false, "Err 2");

    const deadLetters = integrationRetryQueue.getDeadLetters(tenantId);
    expect(deadLetters.length).toBe(1);
    const dlId = deadLetters[0].id;

    // Replay with handler
    let replayedPayload: any = null;
    const replayResult = await integrationRetryQueue.replayDeadLetter(dlId, async (payload) => {
      replayedPayload = payload;
      return true;
    });

    expect(replayResult.success).toBe(true);
    expect(replayedPayload).toEqual({ externalOrderId: "wolt-99", status: "READY" });

    // Verify record marked as replayed
    const updatedDl = integrationRetryQueue.getDeadLetters(tenantId)[0];
    expect(updatedDl.replayed).toBe(true);
  });
});
