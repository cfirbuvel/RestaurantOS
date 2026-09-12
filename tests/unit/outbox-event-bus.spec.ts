import { describe, it, expect, beforeEach } from "vitest";
import { eventBus, DomainEvent } from "@/core/events/event-bus";
import { outboxProcessor } from "@/core/events/outbox-processor";
import { memoryDb } from "@/core/database/db";
import { mockRedis } from "@/core/cache/redis";

describe("Typed Event Subsystem & Transactional Outbox", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("should record domain event in outbox and dispatch to local subscriber", async () => {
    const receivedEvents: DomainEvent[] = [];
    eventBus.subscribe("OrderCreated", (evt) => {
      receivedEvents.push(evt);
    });

    const tenantId = crypto.randomUUID();
    const branchId = crypto.randomUUID();

    const published = await eventBus.publish({
      eventType: "OrderCreated",
      tenantId,
      branchId,
      correlationId: "req_test_123",
      causationId: "cmd_checkout_456",
      actor: { actorId: "user_789", actorType: "USER" },
      payload: {
        orderId: "ord_001",
        totalAmount: 154.5,
        itemsCount: 3,
      },
    });

    expect(published.eventId).toBeDefined();
    expect(published.eventType).toBe("OrderCreated");
    expect(published.correlationId).toBe("req_test_123");
    expect(published.causationId).toBe("cmd_checkout_456");

    // Local handler received it
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].eventId).toBe(published.eventId);

    // Outbox table persisted the event
    const outboxRecords = memoryDb.find("outbox_events", (e) => e.event_id === published.eventId);
    expect(outboxRecords).toHaveLength(1);
    expect(outboxRecords[0].published).toBe(false);
    expect(outboxRecords[0].correlation_id).toBe("req_test_123");
  });

  it("should relay unpublished outbox events to Redis and mark them published", async () => {
    const tenantId = crypto.randomUUID();

    // Create 3 unpublished events in outbox
    for (let i = 1; i <= 3; i++) {
      memoryDb.insert("outbox_events", {
        event_id: crypto.randomUUID(),
        event_type: "DeliveryAssigned",
        version: "1.0",
        tenant_id: tenantId,
        actor_id: "system",
        payload: { deliveryId: `del_${i}` },
        correlation_id: `req_${i}`,
        published: false,
        retry_count: 0,
      });
    }

    const initialUnpublished = memoryDb.find("outbox_events", (e) => !e.published);
    expect(initialUnpublished).toHaveLength(3);

    // Run Outbox Processor batch
    const processed = await outboxProcessor.processBatch();
    expect(processed).toBe(3);

    // All events should now be marked published
    const remainingUnpublished = memoryDb.find("outbox_events", (e) => !e.published);
    expect(remainingUnpublished).toHaveLength(0);

    const publishedRecords = memoryDb.find("outbox_events", (e) => e.published);
    expect(publishedRecords).toHaveLength(3);
    expect(publishedRecords[0].published_at).toBeDefined();
  });
});
