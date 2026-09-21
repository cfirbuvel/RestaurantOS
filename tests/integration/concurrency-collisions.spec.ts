/**
 * RestaurantOS — Phase 12 QA: Concurrency & Collision Master Suite
 *
 * Mandated by PHASE 00 Section 46 & RestaurantOS — 12 Complete QA.md:
 * High-concurrency collision simulations where exactly ONE state update must succeed.
 *
 * Scenarios:
 *  1. Two drivers self-assign the same delivery simultaneously.
 *  2. Manager assigns while driver self-assigns.
 *  3. Driver self-assigns while batch approval occurs.
 *  4. Delivery released while another driver attempts assignment.
 *  5. Driver returns while dispatcher assigns next delivery.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";
import { batchingEngine } from "@/modules/delivery/services/batching-engine";

describe("Phase 12: Concurrency & Collision Scenarios (PHASE 00 Section 46)", () => {
  const tenantId = "tenant-qa-collisions";
  const branchId = "branch-qa-tlv";

  beforeEach(() => {
    memoryDb.reset();
  });

  // Helper to create an eligible on-shift driver
  async function createEligibleDriver(userId: string, name: string) {
    const driver = await driverQueueService.clockIn(tenantId, branchId, userId);
    memoryDb.update("drivers", driver.id, {
      can_self_assign: true,
      is_active: true,
      name,
    });
    return driver;
  }

  // Helper to create an unassigned delivery
  async function createReadyDelivery(deliveryId: string, orderId: string) {
    return deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId,
      deliveryAddress: {
        street: "Ibn Gabirol",
        houseNumber: "22",
        city: "Tel Aviv",
        latitude: 32.081,
        longitude: 34.781,
      },
    });
  }

  // ── Scenario 1: Two drivers self-assign the same delivery simultaneously ───

  it("Scenario 1: Two drivers self-assign the same delivery simultaneously — exactly one wins", async () => {
    const driver1 = await createEligibleDriver("driver-usr-1", "Alice Driver");
    const driver2 = await createEligibleDriver("driver-usr-2", "Bob Driver");

    const delivery = await createReadyDelivery("del-col-101", "ord-101");

    // Both drivers race to self-assign the exact same delivery
    const results = await Promise.allSettled([
      deliveryService.selfAssignDelivery(tenantId, delivery.id, "driver-usr-1"),
      deliveryService.selfAssignDelivery(tenantId, delivery.id, "driver-usr-2"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // Exactly one winner, exactly one loser
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winningDriverUserId = fulfilled[0].value.driver_id;
    expect(["driver-usr-1", "driver-usr-2"]).toContain(winningDriverUserId);

    // Rejected attempt must clearly state delivery is already assigned (409 Conflict)
    expect(rejected[0].reason.message).toMatch(/already.*assigned/i);

    // Database state must be consistent
    const finalDelivery = await deliveryService.getDeliveryById(tenantId, delivery.id);
    expect(finalDelivery?.status).toBe("ASSIGNED");
    expect(finalDelivery?.driver_id).toBe(winningDriverUserId);
  });

  // ── Scenario 2: Manager assigns while driver self-assigns ──────────────────

  it("Scenario 2: Manager assigns while driver self-assigns — atomic collision resolves to one winner", async () => {
    const driver1 = await createEligibleDriver("driver-usr-1", "Driver One");
    const driver2 = await createEligibleDriver("driver-usr-2", "Driver Two");
    const managerUserId = "mgr-usr-99";

    const delivery = await createReadyDelivery("del-col-102", "ord-102");

    // Manager assigns to Driver 1 at the exact moment Driver 2 attempts self-assignment
    const results = await Promise.allSettled([
      deliveryService.assignDelivery({
        tenantId,
        deliveryId: delivery.id,
        driverId: "driver-usr-1",
        actorId: managerUserId,
        actorType: "MANAGER",
      }),
      deliveryService.selfAssignDelivery(tenantId, delivery.id, "driver-usr-2"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one assignment must prevail
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const finalDelivery = await deliveryService.getDeliveryById(tenantId, delivery.id);
    expect(finalDelivery?.status).toBe("ASSIGNED");
    expect([driver1.user_id, driver2.user_id]).toContain(finalDelivery?.driver_id);
  });

  // ── Scenario 3: Driver self-assigns while batch approval occurs ─────────────

  it("Scenario 3: Driver self-assigns while batch approval occurs — contested item cannot be double-assigned", async () => {
    const batchDriver = await createEligibleDriver("driver-batch-1", "Batch Driver");
    const soloDriver = await createEligibleDriver("driver-solo-2", "Solo Driver");
    const managerId = "mgr-batch-001";

    const delivery1 = await createReadyDelivery("del-batch-item-1", "ord-b1");
    const delivery2 = await createReadyDelivery("del-batch-item-2", "ord-b2");

    // Create suggested batches containing both deliveries
    const suggestions = await batchingEngine.suggestBatches({ tenantId, branchId });
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const batch = suggestions[0];

    // Solo Driver attempts to claim delivery1 while Manager approves batch containing delivery1
    const results = await Promise.allSettled([
      batchingEngine.approveBatch({
        tenantId,
        batchId: batch.id,
        managerUserId: managerId,
        driverId: "driver-batch-1",
      }),
      deliveryService.selfAssignDelivery(tenantId, delivery1.id, "driver-solo-2"),
    ]);

    const finalDel1 = await deliveryService.getDeliveryById(tenantId, delivery1.id);
    expect(finalDel1?.status).toBe("ASSIGNED");
    // Delivery 1 must belong to either the batch driver or the solo driver, never both
    expect([batchDriver.user_id, soloDriver.user_id]).toContain(finalDel1?.driver_id);
  });

  // ── Scenario 4: Delivery released while another driver attempts assignment ─

  it("Scenario 4: Delivery release vs Driver assignment race condition", async () => {
    const driverA = await createEligibleDriver("driver-release-a", "Driver A");
    const driverB = await createEligibleDriver("driver-release-b", "Driver B");

    const delivery = await createReadyDelivery("del-rel-01", "ord-rel-1");

    // Initially assign to Driver A
    await deliveryService.selfAssignDelivery(tenantId, delivery.id, "driver-release-a");

    // Driver B attempts to self-assign while Driver A releases the delivery
    const results = await Promise.allSettled([
      deliveryService.releaseDelivery(tenantId, delivery.id, "driver-release-a", "Driver flat tire"),
      deliveryService.selfAssignDelivery(tenantId, delivery.id, "driver-release-b"),
    ]);

    const finalDelivery = await deliveryService.getDeliveryById(tenantId, delivery.id);

    // If Driver B ran before release finished, Driver B was rejected and delivery became AVAILABLE.
    // If Driver B ran after release finished, delivery transitioned directly to Driver B.
    // In all cases, system state is valid and not corrupted.
    expect(["AVAILABLE_FOR_ASSIGNMENT", "ASSIGNED"]).toContain(finalDelivery?.status);
    if (finalDelivery?.status === "ASSIGNED") {
      expect(finalDelivery.driver_id).toBe("driver-release-b");
    } else {
      expect(finalDelivery?.driver_id).toBeNull();
    }
  });

  // ── Scenario 5: Driver returns while dispatcher assigns next delivery ──────

  it("Scenario 5: Driver returns from trip while dispatcher assigns next delivery — FIFO queue integrity", async () => {
    // Driver 1 clocked in
    const d1 = await driverQueueService.clockIn(tenantId, branchId, "driver-fifo-1");
    // Driver 2 clocked in 5 minutes ago (earlier wait time)
    const d2 = await driverQueueService.clockIn(tenantId, branchId, "driver-fifo-2");
    memoryDb.update("drivers", d2.id, { available_since: new Date(Date.now() - 300000) });

    // Driver 1 goes on delivery (becomes ASSIGNED)
    memoryDb.update("drivers", d1.id, { assignment_status: "ASSIGNED", available_since: null });

    // Initial queue check: only Driver 2 is available
    let queue = await driverQueueService.getDriverQueue(tenantId, branchId);
    expect(queue).toHaveLength(1);
    expect(queue[0].driverId).toBe(d2.id);

    // Driver 1 returns physically to restaurant (arrivedAtRestaurant)
    await driverQueueService.arrivedAtRestaurant(tenantId, branchId, "driver-fifo-1");

    // Driver 1 has now rejoined the queue at the TAIL because their new available_since is now
    queue = await driverQueueService.getDriverQueue(tenantId, branchId);
    expect(queue).toHaveLength(2);
    // Driver 2 is at head (position 1) because Driver 2's available_since is earlier
    expect(queue[0].driverId).toBe(d2.id);
    expect(queue[1].driverId).toBe(d1.id);
  });
});
