/**
 * Stock Count & Physical Inventory Reconciliation Service
 * Phase 5 - Full Variance Detection & Adjustment Engine
 */

import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  InventoryCount,
  InventoryCountItem,
  CountStatus,
} from "../domain/inventory";
import { inventoryService } from "./inventory-service";
import { unitConversionService } from "./unit-conversion-service";

export class StockCountService {
  /**
   * Create and record a physical stock count session
   */
  async createCountSession(params: {
    tenantId: string;
    branchId: string;
    warehouseId: string;
    countedBy?: string;
    notes?: string;
    items: Array<{
      ingredientId: string;
      countedQuantity: number;
      unitId: string;
    }>;
  }): Promise<InventoryCount> {
    const { tenantId, branchId, warehouseId, countedBy, notes, items } = params;

    const countNumber = `CNT-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      Math.random() * 1000
    )}`;

    const countRecord = memoryDb.insert("inventory_counts", {
      tenant_id: tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      count_number: countNumber,
      status: "COMPLETED" as CountStatus,
      counted_by: countedBy || null,
      reconciled_by: null,
      started_at: new Date(),
      completed_at: new Date(),
      reconciled_at: null,
      notes: notes || null,
    });

    const countItems: InventoryCountItem[] = [];

    for (const item of items) {
      const ingredient = await inventoryService.getIngredient(tenantId, item.ingredientId);
      if (!ingredient) {
        throw new Error(`Ingredient ${item.ingredientId} not found`);
      }

      // Find current stock in this warehouse
      const stocks = await inventoryService.listStockLevels(tenantId, warehouseId);
      const stock = stocks.find((s: any) => s.ingredient_id === item.ingredientId);

      const currentSystemQtyInPrimary = stock ? Number(stock.quantity) : 0;
      const primaryUnitId = ingredient.primary_unit_id;

      // Convert counted qty to primary unit
      const countedQtyInPrimary = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: item.unitId,
        toUnitId: primaryUnitId,
        quantity: item.countedQuantity,
      });

      const variance = Number((countedQtyInPrimary - currentSystemQtyInPrimary).toFixed(4));
      const unitCost = Number(ingredient.cost_per_unit || 0);
      const varianceCost = Number((variance * unitCost).toFixed(2));

      const countItemRecord = memoryDb.insert("inventory_count_items", {
        tenant_id: tenantId,
        count_id: countRecord.id,
        ingredient_id: item.ingredientId,
        system_quantity: currentSystemQtyInPrimary,
        counted_quantity: countedQtyInPrimary,
        variance,
        unit_id: primaryUnitId,
        unit_cost: unitCost,
        variance_cost: varianceCost,
        reconciled: false,
      });

      countItems.push({
        ...countItemRecord,
        ingredient,
      });
    }

    return {
      ...countRecord,
      items: countItems,
    };
  }

  /**
   * Reconcile stock count discrepancies:
   * Adjusts system inventory levels to match physical counts and logs movements.
   */
  async reconcileCount(params: {
    tenantId: string;
    branchId: string;
    countId: string;
    reconciledBy?: string;
  }): Promise<{ count: InventoryCount; adjustmentsApplied: number }> {
    const { tenantId, countId, reconciledBy } = params;

    const countRecord = memoryDb.findById("inventory_counts", countId);
    if (!countRecord || countRecord.tenant_id !== tenantId) {
      throw new Error(`Inventory count ${countId} not found`);
    }

    if (countRecord.reconciled_at) {
      throw new Error(`Inventory count ${countId} has already been reconciled`);
    }

    const items = memoryDb.find(
      "inventory_count_items",
      (i: any) => i.count_id === countId && i.tenant_id === tenantId
    );

    let adjustmentsApplied = 0;

    for (const item of items) {
      if (item.reconciled || item.variance === 0) {
        item.reconciled = true;
        continue;
      }

      // Apply adjustment for variance
      await inventoryService.adjustStock({
        tenantId,
        warehouseId: countRecord.warehouse_id,
        ingredientId: item.ingredient_id,
        adjustmentQuantity: item.variance,
        unitId: item.unit_id,
        movementType: "COUNT_ADJUSTMENT",
        reason: `Reconciliation from count ${countRecord.count_number} (Variance: ${item.variance} ${item.unit_id})`,
        referenceType: "STOCK_TAKE",
        referenceId: countId,
        actorId: reconciledBy,
        allowNegative: true,
      });

      item.reconciled = true;
      adjustmentsApplied++;
    }

    countRecord.status = "RECONCILED";
    countRecord.reconciled_by = reconciledBy || null;
    countRecord.reconciled_at = new Date();
    countRecord.updated_at = new Date();

    const populatedItems = items.map((i: any) => ({
      ...i,
      ingredient: memoryDb.findById("ingredients", i.ingredient_id),
    }));

    return {
      count: {
        ...countRecord,
        items: populatedItems,
      },
      adjustmentsApplied,
    };
  }

  /**
   * Get all count sessions for a warehouse or branch
   */
  async getCounts(tenantId: string, warehouseId?: string): Promise<InventoryCount[]> {
    const counts = memoryDb.find("inventory_counts", (c: any) => {
      if (c.tenant_id !== tenantId) return false;
      if (warehouseId && c.warehouse_id !== warehouseId) return false;
      return true;
    });

    return counts.map((count: any) => {
      const items = memoryDb
        .find("inventory_count_items", (i: any) => i.count_id === count.id)
        .map((i: any) => ({
          ...i,
          ingredient: memoryDb.findById("ingredients", i.ingredient_id),
        }));
      return {
        ...count,
        items,
      };
    });
  }

  /**
   * Get single count session details
   */
  async getCountById(tenantId: string, countId: string): Promise<InventoryCount | null> {
    const count = memoryDb.findById("inventory_counts", countId);
    if (!count || count.tenant_id !== tenantId) return null;

    const items = memoryDb
      .find("inventory_count_items", (i: any) => i.count_id === count.id)
      .map((i: any) => ({
        ...i,
        ingredient: memoryDb.findById("ingredients", i.ingredient_id),
      }));

    return {
      ...count,
      items,
    };
  }
}

export const stockCountService = new StockCountService();
