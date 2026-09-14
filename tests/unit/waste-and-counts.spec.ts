import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { wasteService } from "@/modules/inventory/services/waste-service";
import { stockCountService } from "@/modules/inventory/services/stock-count-service";
import { inventoryService } from "@/modules/inventory/services/inventory-service";

describe("Phase 5: Waste Tracking & Stock Count Reconciliation", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const whKitchenId = "wh-02-kitchen";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  describe("Waste Tracking", () => {
    it("records ingredient waste, deducts stock, and calculates cost impact", async () => {
      // Burger buns cost 2.20 each. Kitchen starts with 200 buns.
      const record = await wasteService.recordWaste({
        tenantId,
        branchId,
        warehouseId: whKitchenId,
        ingredientId: "ing-02-burger-bun",
        quantity: 10,
        unitId: "unit",
        wasteReason: "EXPIRED",
        notes: "Expired over weekend",
        reportedBy: "usr-kitchen-mgr",
      });

      expect(record.id).toBeDefined();
      expect(record.cost_impact).toBe(22.0); // 10 * 2.20

      // Stock in kitchen should be reduced from 200 to 190
      const stock = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-02-burger-bun");
      expect(stock.quantity).toBe(190);
    });

    it("aggregates waste summary by reason and total financial loss", async () => {
      // Record multiple waste entries
      await wasteService.recordWaste({
        tenantId,
        branchId,
        warehouseId: whKitchenId,
        ingredientId: "ing-02-burger-bun",
        quantity: 5,
        unitId: "unit",
        wasteReason: "DROPPED",
        reportedBy: "usr-kitchen-mgr",
      }); // 5 * 2.20 = 11.00

      await wasteService.recordWaste({
        tenantId,
        branchId,
        warehouseId: whKitchenId,
        ingredientId: "ing-03-cheddar-slice",
        quantity: 10,
        unitId: "unit",
        wasteReason: "SPOILED",
        reportedBy: "usr-kitchen-mgr",
      }); // 10 * 1.10 = 11.00

      const summary = await wasteService.getWasteSummary(tenantId, { branchId });
      expect(summary.totalCostImpact).toBe(22.0);
      expect(summary.countByReason["DROPPED"]).toBe(1);
      expect(summary.countByReason["SPOILED"]).toBe(1);
      expect(summary.costByReason["DROPPED"]).toBe(11.0);
      expect(summary.costByReason["SPOILED"]).toBe(11.0);
    });
  });

  describe("Stock Counts & Reconciliation", () => {
    it("computes variance between physical count and system stock", async () => {
      // Kitchen buns system stock: 200 units
      // Physical count finds 185 units (variance: -15)
      const countSession = await stockCountService.createCountSession({
        tenantId,
        branchId,
        warehouseId: whKitchenId,
        countedBy: "usr-manager-01",
        notes: "Monthly physical count",
        items: [
          {
            ingredientId: "ing-02-burger-bun",
            countedQuantity: 185,
            unitId: "unit",
          },
        ],
      });

      expect(countSession.count_number).toBeDefined();
      expect(countSession.items?.length).toBe(1);

      const bunCountItem = countSession.items?.[0];
      expect(bunCountItem?.system_quantity).toBe(200);
      expect(bunCountItem?.counted_quantity).toBe(185);
      expect(bunCountItem?.variance).toBe(-15);
      expect(bunCountItem?.variance_cost).toBe(-33.0); // -15 * 2.20
      expect(bunCountItem?.reconciled).toBe(false);
    });

    it("reconciles count discrepancies by adjusting stock to counted physical quantity", async () => {
      const countSession = await stockCountService.createCountSession({
        tenantId,
        branchId,
        warehouseId: whKitchenId,
        countedBy: "usr-manager-01",
        items: [
          {
            ingredientId: "ing-02-burger-bun",
            countedQuantity: 185,
            unitId: "unit",
          },
        ],
      });

      const reconciliation = await stockCountService.reconcileCount({
        tenantId,
        branchId,
        countId: countSession.id,
        reconciledBy: "usr-manager-01",
      });

      expect(reconciliation.adjustmentsApplied).toBe(1);
      expect(reconciliation.count.status).toBe("RECONCILED");

      // System stock should now exactly equal 185
      const stock = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-02-burger-bun");
      expect(stock.quantity).toBe(185);

      // Verify cannot reconcile twice
      await expect(
        stockCountService.reconcileCount({
          tenantId,
          branchId,
          countId: countSession.id,
        })
      ).rejects.toThrow("already been reconciled");
    });
  });
});
