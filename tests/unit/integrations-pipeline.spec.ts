import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { memoryDb } from "@/core/database/db";
import { integrationPipelineRunner } from "@/modules/integrations/core/integration-pipeline";
import { MockWoltAdapter } from "@/modules/integrations/aggregators/wolt-adapter";

describe("Integration Pipeline (10-Step Normalized Pipeline)", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const secret = "test-wolt-secret-key-123";
  let adapter: MockWoltAdapter;

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
    adapter = new MockWoltAdapter("test-key", secret);
  });

  it("successfully processes valid inbound Wolt order through all 10 pipeline steps", async () => {
    const rawPayload = JSON.stringify({
      order: {
        id: "wolt-ord-1001",
        venue_id: "venue-1",
        customer: {
          name: "אבי כהן",
          phone_number: "054-9988776",
          email: "avi@example.com",
        },
        delivery: {
          type: "homedelivery",
          location: {
            street_address: "רוטשילד 10",
            city: "תל אביב",
            apartment: "2",
          },
        },
        items: [
          {
            id: "dish-1",
            name: "המבורגר בקר 220 גרם",
            count: 2,
            base_price: 6000,
            total_price: 12000,
            options: [{ name: "צ'יפס בצד", price: 0 }],
          },
        ],
        price: { amount: 13500, currency: "ILS" },
        delivery_fee: { amount: 1500 },
        tip: { amount: 0 },
      },
    });

    const signature = adapter.signPayload(rawPayload, secret);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const result = await integrationPipelineRunner.processInboundOrder({
      provider: "WOLT",
      rawBody: rawPayload,
      headers: {
        "x-wolt-signature": signature,
        "x-wolt-timestamp": timestamp,
      },
      secret,
      tenantId,
      branchId,
      transform: (payload) => adapter.transformToCanonicalOrder(payload),
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.orderId).toBeDefined();
    expect(result.orderNumber).toBeDefined();

    // Verify order was created in Universal Orders table with correct channel
    const orders = memoryDb.find("orders", (o: any) => o.id === result.orderId);
    expect(orders.length).toBe(1);
    expect(orders[0].channel).toBe("WOLT");
    expect(orders[0].external_order_id).toBe("wolt-ord-1001");
  });

  it("rejects inbound payload when cryptographic signature is invalid", async () => {
    const rawPayload = JSON.stringify({
      order: { id: "wolt-ord-fake", items: [] },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const result = await integrationPipelineRunner.processInboundOrder({
      provider: "WOLT",
      rawBody: rawPayload,
      headers: {
        "x-wolt-signature": "sha256=invalid_signature_hex_code_deadbeef",
        "x-wolt-timestamp": timestamp,
      },
      secret,
      tenantId,
      branchId,
      transform: (payload) => adapter.transformToCanonicalOrder(payload),
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.reason).toMatch(/signature/i);
  });

  it("rejects stale request older than 300s to prevent replay attacks (Phase 00 §36)", async () => {
    const rawPayload = JSON.stringify({
      order: { id: "wolt-ord-stale", items: [] },
    });

    const signature = adapter.signPayload(rawPayload, secret);
    // Timestamp 400 seconds in the past (> 300s tolerance)
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();

    const result = await integrationPipelineRunner.processInboundOrder({
      provider: "WOLT",
      rawBody: rawPayload,
      headers: {
        "x-wolt-signature": signature,
        "x-wolt-timestamp": staleTimestamp,
      },
      secret,
      tenantId,
      branchId,
      transform: (payload) => adapter.transformToCanonicalOrder(payload),
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.reason).toContain("replay attack");
  });

  it("enforces idempotency and suppresses duplicate order ingestion (Phase 00 §37)", async () => {
    const rawPayload = JSON.stringify({
      order: {
        id: "wolt-ord-idempotent-99",
        customer: { name: "שרה לוי", phone_number: "052-1112233" },
        items: [{ id: "dish-item", name: "סלט יווני", count: 1, base_price: 4500 }],
        price: { amount: 4500, currency: "ILS" },
      },
    });

    const signature = adapter.signPayload(rawPayload, secret);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // First attempt
    const firstRes = await integrationPipelineRunner.processInboundOrder({
      provider: "WOLT",
      rawBody: rawPayload,
      headers: {
        "x-wolt-signature": signature,
        "x-wolt-timestamp": timestamp,
      },
      secret,
      tenantId,
      branchId,
      transform: (payload) => adapter.transformToCanonicalOrder(payload),
    });
    expect(firstRes.success).toBe(true);
    expect(firstRes.duplicate).toBeFalsy();

    // Second duplicate attempt with identical payload & signature
    const secondRes = await integrationPipelineRunner.processInboundOrder({
      provider: "WOLT",
      rawBody: rawPayload,
      headers: {
        "x-wolt-signature": signature,
        "x-wolt-timestamp": timestamp,
      },
      secret,
      tenantId,
      branchId,
      transform: (payload) => adapter.transformToCanonicalOrder(payload),
    });

    expect(secondRes.success).toBe(true);
    expect(secondRes.duplicate).toBe(true);
    expect(secondRes.orderId).toBe(firstRes.orderId);

    // Verify only ONE order exists in database
    const orders = memoryDb.find(
      "orders",
      (o: any) => o.external_order_id === "wolt-ord-idempotent-99"
    );
    expect(orders.length).toBe(1);
  });
});
