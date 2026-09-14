import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { inventoryService } from "@/modules/inventory/services/inventory-service";

describe("Phase 5: Order Depletion Engine & Policies", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const orderId = "ord-01-seed-sample";
  const kitchenWhId = "wh-02-kitchen";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  it("depletes stock on ON_ACCEPTED trigger when branch policy is default ON_ACCEPTED", async () => {
    // Check initial bun stock: 200 units
    const bunStockBefore = memoryDb.find(
      "inventory_stocks",
      (s: any) => s.warehouse_id === kitchenWhId && s.ingredient_id === "ing-02-burger-bun"
    )[0];
    expect(bunStockBefore.quantity).toBe(200);

    // Order has 1x Classic Burger (with 1 bun) = 1 bun
    const result = await inventoryService.depleteStockForOrder({
      tenantId,
      branchId,
      orderId,
      trigger: "ON_ACCEPTED",
      actorId: "usr-manager-01",
    });

    expect(result.depleted).toBe(true);
    expect(result.movementsCount).toBeGreaterThan(0);

    const bunStockAfter = memoryDb.find(
      "inventory_stocks",
      (s: any) => s.warehouse_id === kitchenWhId && s.ingredient_id === "ing-02-burger-bun"
    )[0];
    expect(bunStockAfter.quantity).toBe(199); // 200 - 1
  });

  it("does not deplete stock if trigger does not match branch policy", async () => {
    // Branch policy is ON_ACCEPTED by default
    const result = await inventoryService.depleteStockForOrder({
      tenantId,
      branchId,
      orderId,
      trigger: "ON_FULFILLMENT",
    });

    expect(result.depleted).toBe(false);
    expect(result.movementsCount).toBe(0);
  });

  it("respects branch operational policy override (e.g. ON_PREPARATION_START)", async () => {
    // Update branch setting to ON_PREPARATION_START
    const branch = memoryDb.findById("branches", branchId);
    branch.operational_settings = {
      ...branch.operational_settings,
      inventoryDepletionPolicy: "ON_PREPARATION_START",
    };

    // ON_ACCEPTED trigger now should NOT deplete
    const accResult = await inventoryService.depleteStockForOrder({
      tenantId,
      branchId,
      orderId,
      trigger: "ON_ACCEPTED",
    });
    expect(accResult.depleted).toBe(false);

    // ON_PREPARATION_START trigger SHOULD deplete
    const prepResult = await inventoryService.depleteStockForOrder({
      tenantId,
      branchId,
      orderId,
      trigger: "ON_PREPARATION_START",
    });
    expect(prepResult.depleted).toBe(true);
  });

  it("rolls back all depleted stock on order cancellation", async () => {
    // First deplete
    await inventoryService.depleteStockForOrder({
      tenantId,
      branchId,
      orderId,
      trigger: "ON_ACCEPTED",
    });

    const bunStockDepleted = memoryDb.find(
      "inventory_stocks",
      (s: any) => s.warehouse_id === kitchenWhId && s.ingredient_id === "ing-02-burger-bun"
    )[0];
    expect(bunStockDepleted.quantity).toBe(199);

    // Now Cancel Order & Rollback
    const rollback = await inventoryService.rollbackStockForOrder({
      tenantId,
      branchId,
      orderId,
      reason: "Customer changed mind before preparation",
      actorId: "usr-cashier-01",
    });

    expect(rollback.restored).toBe(true);
    expect(rollback.movementsCount).toBeGreaterThan(0);

    const bunStockRestored = memoryDb.find(
      "inventory_stocks",
      (s: any) => s.warehouse_id === kitchenWhId && s.ingredient_id === "ing-02-burger-bun"
    )[0];
    expect(bunStockRestored.quantity).toBe(200); // Back to original!
  });
});
