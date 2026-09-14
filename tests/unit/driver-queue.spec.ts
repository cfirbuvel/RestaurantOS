import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";
import { deliveryService } from "@/modules/delivery/services/delivery-service";

describe("Phase 4: Driver Multidimensional State & FIFO Queue", () => {
  const tenantId = "org-test-queue";
  const branchId = "branch-test-tlv";

  const driver1UserId = "usr-driver-1";
  const driver2UserId = "usr-driver-2";
  const driver3UserId = "usr-driver-3";

  beforeEach(() => {
    memoryDb.reset();
  });

  it("should maintain strict FIFO ordering based on available_since ASC", async () => {
    // Driver 1 clocks in first at T0
    await driverQueueService.clockIn(tenantId, branchId, driver1UserId);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Driver 2 clocks in at T1
    await driverQueueService.clockIn(tenantId, branchId, driver2UserId);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Driver 3 clocks in at T2
    await driverQueueService.clockIn(tenantId, branchId, driver3UserId);

    const queue = await driverQueueService.getDriverQueue(tenantId, branchId);
    expect(queue).toHaveLength(3);
    expect(queue[0].userId).toBe(driver1UserId);
    expect(queue[0].queuePosition).toBe(1);
    expect(queue[1].userId).toBe(driver2UserId);
    expect(queue[1].queuePosition).toBe(2);
    expect(queue[2].userId).toBe(driver3UserId);
    expect(queue[2].queuePosition).toBe(3);
  });

  it("should remove driver on break from queue and place at the end of queue on return", async () => {
    await driverQueueService.clockIn(tenantId, branchId, driver1UserId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await driverQueueService.clockIn(tenantId, branchId, driver2UserId);

    // Driver 1 takes a break
    const onBreak = await driverQueueService.startBreak(tenantId, branchId, driver1UserId);
    expect(onBreak.shift_status).toBe("BREAK");
    expect(onBreak.available_since).toBeNull();

    // Driver 2 is now first in queue
    let queue = await driverQueueService.getDriverQueue(tenantId, branchId);
    expect(queue).toHaveLength(1);
    expect(queue[0].userId).toBe(driver2UserId);

    // Driver 1 returns from break -> moves to back of queue (T3 > T1)
    await new Promise((resolve) => setTimeout(resolve, 20));
    const returned = await driverQueueService.returnFromBreak(tenantId, branchId, driver1UserId);
    expect(returned.shift_status).toBe("ON_SHIFT");
    expect(returned.available_since).toBeDefined();

    queue = await driverQueueService.getDriverQueue(tenantId, branchId);
    expect(queue).toHaveLength(2);
    expect(queue[0].userId).toBe(driver2UserId); // Driver 2 is first
    expect(queue[1].userId).toBe(driver1UserId); // Driver 1 is now second
  });

  it("should handle physical return to restaurant resetting queue position", async () => {
    await driverQueueService.clockIn(tenantId, branchId, driver1UserId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await driverQueueService.clockIn(tenantId, branchId, driver2UserId);

    // Driver 1 returns to restaurant after completing a run
    await new Promise((resolve) => setTimeout(resolve, 20));
    await driverQueueService.arrivedAtRestaurant(tenantId, branchId, driver1UserId);

    const queue = await driverQueueService.getDriverQueue(tenantId, branchId);
    expect(queue[0].userId).toBe(driver2UserId);
    expect(queue[1].userId).toBe(driver1UserId);
  });

  it("should remove clocked-out driver from availability queue", async () => {
    await driverQueueService.clockIn(tenantId, branchId, driver1UserId);
    await driverQueueService.clockIn(tenantId, branchId, driver2UserId);

    await driverQueueService.clockOut(tenantId, branchId, driver1UserId);

    const queue = await driverQueueService.getDriverQueue(tenantId, branchId);
    expect(queue).toHaveLength(1);
    expect(queue[0].userId).toBe(driver2UserId);
  });

  it("should enforce atomic concurrency protection on self-assignment (prevent double claim)", async () => {
    // Both drivers clock in first
    await driverQueueService.clockIn(tenantId, branchId, driver1UserId);
    await driverQueueService.clockIn(tenantId, branchId, driver2UserId);

    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord-race-1",
      deliveryAddress: { street: "Rothschild", houseNumber: "1", city: "Tel Aviv" },
    });

    // Driver 1 claims the delivery first
    const claimed = await deliveryService.selfAssignDelivery(tenantId, delivery.id, driver1UserId);
    expect(claimed.status).toBe("ASSIGNED");
    expect(claimed.driver_id).toBe(driver1UserId);

    // Driver 2 attempts to claim the same delivery
    let errorThrown: any = null;
    try {
      await deliveryService.selfAssignDelivery(tenantId, delivery.id, driver2UserId);
    } catch (err: any) {
      errorThrown = err;
    }
    expect(errorThrown).not.toBeNull();
    expect(errorThrown.message).toContain("already been assigned");
  });
});
