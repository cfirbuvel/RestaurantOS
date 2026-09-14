import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { unitConversionService } from "@/modules/inventory/services/unit-conversion-service";
import { inventoryService } from "@/modules/inventory/services/inventory-service";

describe("Phase 5: Inventory Stock & Unit Conversions", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const warehouseId = "wh-02-kitchen";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  describe("Unit Conversion Engine", () => {
    it("converts standard weight units (kg <-> g)", async () => {
      const kgToG = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: "kg",
        toUnitId: "g",
        quantity: 2.5,
      });
      expect(kgToG).toBe(2500);

      const gToKg = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: "g",
        toUnitId: "kg",
        quantity: 1500,
      });
      expect(gToKg).toBe(1.5);
    });

    it("converts standard volume units (l <-> ml)", async () => {
      const lToMl = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: "l",
        toUnitId: "ml",
        quantity: 3,
      });
      expect(lToMl).toBe(3000);

      const mlToL = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: "ml",
        toUnitId: "l",
        quantity: 750,
      });
      expect(mlToL).toBe(0.75);
    });

    it("returns same quantity for identity conversion", async () => {
      const qty = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: "unit",
        toUnitId: "unit",
        quantity: 42,
      });
      expect(qty).toBe(42);
    });

    it("throws error for incompatible dimensions (e.g. weight to volume without density)", async () => {
      await expect(
        unitConversionService.convertQuantity({
          tenantId,
          fromUnitId: "g",
          toUnitId: "ml",
          quantity: 100,
        })
      ).rejects.toThrow("Incompatible or missing unit conversion");
    });
  });

  describe("Stock Adjustments & Negative Stock Guard", () => {
    it("increases stock on positive manual adjustment", async () => {
      const result = await inventoryService.adjustStock({
        tenantId,
        warehouseId,
        ingredientId: "ing-02-burger-bun",
        adjustmentQuantity: 50,
        unitId: "unit",
        reason: "Supplier delivered extra buns",
        actorId: "usr-manager-01",
      });

      expect(result.stock.quantity).toBe(250);
      expect(result.movement.movement_type).toBe("COUNT_ADJUSTMENT");
      expect(result.movement.quantity).toBe(50);
    });

    it("prevents negative stock when allowNegative is false", async () => {
      await expect(
        inventoryService.adjustStock({
          tenantId,
          warehouseId,
          ingredientId: "ing-02-burger-bun",
          adjustmentQuantity: -9999,
          unitId: "unit",
          reason: "Excessive deduction",
          allowNegative: false,
        })
      ).rejects.toThrow("Negative stock is not permitted");
    });

    it("allows negative stock when allowNegative is true (e.g. fast line prep)", async () => {
      const result = await inventoryService.adjustStock({
        tenantId,
        warehouseId,
        ingredientId: "ing-02-burger-bun",
        adjustmentQuantity: -300,
        unitId: "unit",
        reason: "Kitchen rush depletion",
        allowNegative: true,
      });

      expect(result.stock.quantity).toBe(-100);
    });

    it("enforces idempotency via idempotencyKey", async () => {
      const key = "test_idempotent_adj_01";
      const first = await inventoryService.adjustStock({
        tenantId,
        warehouseId,
        ingredientId: "ing-02-burger-bun",
        adjustmentQuantity: 10,
        unitId: "unit",
        idempotencyKey: key,
      });

      const second = await inventoryService.adjustStock({
        tenantId,
        warehouseId,
        ingredientId: "ing-02-burger-bun",
        adjustmentQuantity: 10,
        unitId: "unit",
        idempotencyKey: key,
      });

      expect(first.movement.id).toBe(second.movement.id);
      expect(second.stock.quantity).toBe(210); // Not 220
    });
  });

  describe("Low Stock Threshold Alerts", () => {
    it("detects ingredients falling below reorder point or minimum stock level", async () => {
      // Beef patty starts with 44,000g in kitchen. Reorder point is 15,000g, min is 5,000g.
      // Deduct 35,000g -> 9,000g remaining (below reorder point of 15,000g)
      await inventoryService.adjustStock({
        tenantId,
        warehouseId,
        ingredientId: "ing-01-beef-patty",
        adjustmentQuantity: -35000,
        unitId: "g",
        reason: "Simulate massive sales",
      });

      const alerts = await inventoryService.getLowStockAlerts(tenantId, branchId);
      const beefAlert = alerts.find((a) => a.ingredient.id === "ing-01-beef-patty");

      expect(beefAlert).toBeDefined();
      expect(beefAlert?.currentQuantity).toBe(9000);
      expect(beefAlert?.reorderPoint).toBe(15000);
      expect(beefAlert?.isCritical).toBe(false); // 9,000 > 5,000 min

      // Deduct further to 3,000g (below min stock level of 5,000g)
      await inventoryService.adjustStock({
        tenantId,
        warehouseId,
        ingredientId: "ing-01-beef-patty",
        adjustmentQuantity: -6000,
        unitId: "g",
        reason: "Simulate critical drop",
      });

      const criticalAlerts = await inventoryService.getLowStockAlerts(tenantId, branchId);
      const criticalBeefAlert = criticalAlerts.find((a) => a.ingredient.id === "ing-01-beef-patty");

      expect(criticalBeefAlert).toBeDefined();
      expect(criticalBeefAlert?.currentQuantity).toBe(3000);
      expect(criticalBeefAlert?.isCritical).toBe(true);
    });
  });
});
