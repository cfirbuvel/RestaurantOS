import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { batchingEngine } from "@/modules/delivery/services/batching-engine";
import { deliveryService } from "@/modules/delivery/services/delivery-service";

describe("Phase 4: Smart Batching Engine & Advisory Workflow", () => {
  const tenantId = "org-batching-test";
  const branchId = "branch-batching-tlv";
  const managerUserId = "usr-manager-batch";
  const driverUserId = "usr-driver-batch-1";

  beforeEach(() => {
    memoryDb.reset();
  });

  it("should calculate batch score and suggest compatible batches in same direction", async () => {
    // Delivery 1: North-East
    const d1 = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-b1",
      deliveryAddress: {
        street: "Ibn Gabirol",
        houseNumber: "20",
        city: "Tel Aviv",
        latitude: 32.070,
        longitude: 34.780,
      },
    });

    // Delivery 2: North-East, close to D1
    const d2 = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-b2",
      deliveryAddress: {
        street: "Ibn Gabirol",
        houseNumber: "50",
        city: "Tel Aviv",
        latitude: 32.072,
        longitude: 34.782,
      },
    });

    const suggestions = await batchingEngine.suggestBatches({ tenantId, branchId });
    expect(suggestions.length).toBeGreaterThanOrEqual(1);

    const firstBatch = suggestions[0];
    expect(firstBatch.status).toBe("SUGGESTED");
    expect(firstBatch.score).toBeGreaterThanOrEqual(60);
    expect(firstBatch.scoring_breakdown.distanceScore).toBeGreaterThan(80);
    expect(firstBatch.scoring_breakdown.directionScore).toBeGreaterThan(50);
    expect(firstBatch.delivery_ids).toContain(d1.id);
    expect(firstBatch.delivery_ids).toContain(d2.id);

    // Verify decision log was persisted
    const logs = memoryDb.find(
      "intelligence_decision_logs",
      (l: any) => l.tenant_id === tenantId
    );
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].recommendation.batchId).toBe(firstBatch.id);
  });

  it("should approve batch recommendation and assign deliveries to driver", async () => {
    const d1 = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-app-1",
      deliveryAddress: { street: "Arlozorov", houseNumber: "10", city: "Tel Aviv", latitude: 32.086, longitude: 34.780 },
    });
    const d2 = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-app-2",
      deliveryAddress: { street: "Arlozorov", houseNumber: "20", city: "Tel Aviv", latitude: 32.087, longitude: 34.781 },
    });

    const suggestions = await batchingEngine.suggestBatches({ tenantId, branchId });
    expect(suggestions).toHaveLength(1);
    const batchId = suggestions[0].id;

    const approved = await batchingEngine.approveBatch({
      tenantId,
      batchId,
      managerUserId,
      driverId: driverUserId,
    });

    expect(approved.status).toBe("APPROVED");
    expect(approved.approved_by).toBe(managerUserId);
    expect(approved.driver_id).toBe(driverUserId);

    // Deliveries should now be in ASSIGNED status for this driver
    const delivery1 = await deliveryService.getDeliveryById(tenantId, d1.id);
    const delivery2 = await deliveryService.getDeliveryById(tenantId, d2.id);

    expect(delivery1?.status).toBe("ASSIGNED");
    expect(delivery1?.driver_id).toBe(driverUserId);
    expect(delivery2?.status).toBe("ASSIGNED");
    expect(delivery2?.driver_id).toBe(driverUserId);

    // Verify decision log recorded APPROVED
    const logs = memoryDb.find(
      "intelligence_decision_logs",
      (l: any) => l.tenant_id === tenantId && l.recommendation.batchId === batchId
    );
    expect(logs[0].manager_action).toBe("APPROVED");
  });

  it("should reject batch recommendation and record rejection reason in decision log", async () => {
    await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-rej-1",
      deliveryAddress: { street: "Ben Yehuda", houseNumber: "30", city: "Tel Aviv", latitude: 32.080, longitude: 34.770 },
    });
    await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-rej-2",
      deliveryAddress: { street: "Ben Yehuda", houseNumber: "40", city: "Tel Aviv", latitude: 32.081, longitude: 34.771 },
    });

    const suggestions = await batchingEngine.suggestBatches({ tenantId, branchId });
    expect(suggestions).toHaveLength(1);
    const batchId = suggestions[0].id;

    const rejected = await batchingEngine.rejectBatch({
      tenantId,
      batchId,
      managerUserId,
      reason: "Orders are in separate thermal bags with different preparation times",
    });

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejection_reason).toBe("Orders are in separate thermal bags with different preparation times");

    const logs = memoryDb.find(
      "intelligence_decision_logs",
      (l: any) => l.tenant_id === tenantId && l.recommendation.batchId === batchId
    );
    expect(logs[0].manager_action).toBe("REJECTED");
    expect(logs[0].rejection_reason).toBe("Orders are in separate thermal bags with different preparation times");
  });
});
