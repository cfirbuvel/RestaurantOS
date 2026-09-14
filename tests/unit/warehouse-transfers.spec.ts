import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { warehouseService } from "@/modules/inventory/services/warehouse-service";
import { supplierService } from "@/modules/inventory/services/supplier-service";
import { inventoryService } from "@/modules/inventory/services/inventory-service";

describe("Phase 5: Multi-Warehouse Transfers & Supplier Purchase Orders", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const whMainId = "wh-01-main";
  const whKitchenId = "wh-02-kitchen";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  describe("Inter-Warehouse Stock Transfers", () => {
    it("completes full transfer lifecycle: requested -> dispatched -> completed", async () => {
      // Seed initial stock in Main Warehouse (e.g. 500 buns)
      await inventoryService.adjustStock({
        tenantId,
        warehouseId: whMainId,
        ingredientId: "ing-02-burger-bun",
        adjustmentQuantity: 500,
        unitId: "unit",
        reason: "Initial bulk stock in main warehouse",
      });

      // Kitchen starts with 200 buns
      const kitchenBefore = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-02-burger-bun");
      expect(kitchenBefore.quantity).toBe(200);

      // 1. Request transfer of 100 buns from Main to Kitchen
      const transfer = await warehouseService.createTransfer({
        tenantId,
        sourceWarehouseId: whMainId,
        destinationWarehouseId: whKitchenId,
        requestedBy: "usr-kitchen-mgr",
        notes: "Restock morning shift",
        items: [
          {
            ingredientId: "ing-02-burger-bun",
            quantity: 100,
            unitId: "unit",
          },
        ],
      });

      expect(transfer.status).toBe("REQUESTED");

      // 2. Approve & Dispatch -> Main warehouse deducted by 100
      const dispatched = await warehouseService.approveAndDispatchTransfer(
        tenantId,
        transfer.id,
        "usr-manager-01"
      );
      expect(dispatched.status).toBe("IN_TRANSIT");

      const mainAfterDispatch = await inventoryService.getOrCreateStock(tenantId, whMainId, "ing-02-burger-bun");
      expect(mainAfterDispatch.quantity).toBe(400); // 500 - 100

      // Kitchen has not received it yet
      const kitchenDuringTransit = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-02-burger-bun");
      expect(kitchenDuringTransit.quantity).toBe(200);

      // 3. Receive & Complete -> Kitchen credited with 100
      const completed = await warehouseService.completeTransfer(
        tenantId,
        transfer.id,
        "usr-kitchen-mgr"
      );
      expect(completed.status).toBe("COMPLETED");

      const kitchenAfterComplete = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-02-burger-bun");
      expect(kitchenAfterComplete.quantity).toBe(300); // 200 + 100
    });

    it("prevents transfer between identical source and destination", async () => {
      await expect(
        warehouseService.createTransfer({
          tenantId,
          sourceWarehouseId: whMainId,
          destinationWarehouseId: whMainId,
          items: [{ ingredientId: "ing-02-burger-bun", quantity: 10, unitId: "unit" }],
        })
      ).rejects.toThrow("Source and destination warehouses cannot be the same");
    });
  });

  describe("Suppliers & Idempotent Goods Receiving", () => {
    it("creates a purchase order and receives goods into warehouse", async () => {
      // Create PO for 50kg beef from meat supplier
      const po = await supplierService.createPurchaseOrder({
        tenantId,
        branchId,
        supplierId: "sup-01-meat",
        destinationWarehouseId: whKitchenId,
        expectedDeliveryDate: "2026-09-20",
        notes: "Weekly fresh meat delivery",
        items: [
          {
            ingredientId: "ing-01-beef-patty",
            orderedQuantity: 50,
            unitId: "kg",
            unitPrice: 75.0,
          },
        ],
      });

      expect(po.po_number).toBeDefined();
      expect(po.total_amount).toBe(3750); // 50 * 75
      expect(po.status).toBe("DRAFT");

      // Submit PO
      const submitted = await supplierService.submitPurchaseOrder(tenantId, po.id, "usr-manager-01");
      expect(submitted.status).toBe("SUBMITTED");

      // Initial beef stock: 44,000g
      const beefBefore = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-01-beef-patty");
      expect(beefBefore.quantity).toBe(44000);

      // Receive 50kg (50,000g)
      const receipt = await supplierService.receiveGoods({
        tenantId,
        purchaseOrderId: po.id,
        warehouseId: whKitchenId,
        idempotencyKey: "receipt_po_test_01",
        receivedBy: "usr-manager-01",
        items: [
          {
            ingredientId: "ing-01-beef-patty",
            quantity: 50,
            unitId: "kg",
            unitCost: 75.0,
          },
        ],
      });

      expect(receipt.id).toBeDefined();
      expect(receipt.receipt_number).toBeDefined();

      // Beef stock should now be 44,000 + 50,000 = 94,000g
      const beefAfter = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-01-beef-patty");
      expect(beefAfter.quantity).toBe(94000);

      // Verify Idempotency: receiving again with same key does not double-count
      const duplicateReceipt = await supplierService.receiveGoods({
        tenantId,
        purchaseOrderId: po.id,
        warehouseId: whKitchenId,
        idempotencyKey: "receipt_po_test_01",
        receivedBy: "usr-manager-01",
        items: [
          {
            ingredientId: "ing-01-beef-patty",
            quantity: 50,
            unitId: "kg",
            unitCost: 75.0,
          },
        ],
      });

      expect(duplicateReceipt.id).toBe(receipt.id);
      const beefAfterDup = await inventoryService.getOrCreateStock(tenantId, whKitchenId, "ing-01-beef-patty");
      expect(beefAfterDup.quantity).toBe(94000); // Unchanged!
    });
  });
});
