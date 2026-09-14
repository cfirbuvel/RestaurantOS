import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  Ingredient,
  InventoryStock,
  StockMovement,
  DepletionPolicy,
  MovementType,
} from "../domain/inventory";
import { recipeService } from "./recipe-service";
import { unitConversionService } from "./unit-conversion-service";
import { auditLogger } from "@/core/audit/audit-logger";

export class InventoryService {
  /**
   * Create a new raw ingredient
   */
  async createIngredient(params: {
    tenantId: string;
    name: string;
    sku: string;
    category?: string | null;
    primaryUnitId: string;
    storageUnitId: string;
    costPerUnit: number;
    currency?: string;
    minimumStockLevel?: number;
    reorderPoint?: number;
    reorderQuantity?: number;
    allergens?: string[];
  }): Promise<Ingredient> {
    const {
      tenantId,
      name,
      sku,
      category,
      primaryUnitId,
      storageUnitId,
      costPerUnit,
      currency = "ILS",
      minimumStockLevel = 0,
      reorderPoint = 0,
      reorderQuantity = 0,
      allergens = [],
    } = params;

    const ingredientId = `ing_${crypto.randomUUID()}`;
    const now = new Date();

    const ingredient: Ingredient = {
      id: ingredientId,
      tenant_id: tenantId,
      name,
      sku,
      category: category || null,
      primary_unit_id: primaryUnitId,
      storage_unit_id: storageUnitId,
      cost_per_unit: costPerUnit,
      currency,
      minimum_stock_level: minimumStockLevel,
      reorder_point: reorderPoint,
      reorder_quantity: reorderQuantity,
      allergens,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      // Check SKU uniqueness
      const existing = memoryDb.find(
        "ingredients",
        (i: any) => i.tenant_id === tenantId && i.sku === sku
      )[0];
      if (existing) throw new Error(`Ingredient with SKU '${sku}' already exists.`);

      memoryDb.insert("ingredients", ingredient);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO ingredients (
          id, tenant_id, name, sku, category, primary_unit_id, storage_unit_id,
          cost_per_unit, currency, minimum_stock_level, reorder_point, reorder_quantity,
          allergens, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
        [
          ingredient.id,
          ingredient.tenant_id,
          ingredient.name,
          ingredient.sku,
          ingredient.category,
          ingredient.primary_unit_id,
          ingredient.storage_unit_id,
          ingredient.cost_per_unit,
          ingredient.currency,
          ingredient.minimum_stock_level,
          ingredient.reorder_point,
          ingredient.reorder_quantity,
          JSON.stringify(ingredient.allergens),
          ingredient.is_active,
        ]
      );
    }

    return ingredient;
  }

  async getIngredient(tenantId: string, ingredientId: string): Promise<Ingredient | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const ing = memoryDb.findById("ingredients", ingredientId);
      return ing && ing.tenant_id === tenantId ? ing : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM ingredients WHERE id = $1 AND tenant_id = $2",
        [ingredientId, tenantId]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        ...row,
        allergens: typeof row.allergens === "string" ? JSON.parse(row.allergens) : row.allergens,
      };
    }
  }

  async listIngredients(tenantId: string): Promise<Ingredient[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find("ingredients", (i: any) => i.tenant_id === tenantId && i.is_active);
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM ingredients WHERE tenant_id = $1 AND is_active = true ORDER BY category, name ASC",
        [tenantId]
      );
      return res.rows.map((row) => ({
        ...row,
        allergens: typeof row.allergens === "string" ? JSON.parse(row.allergens) : row.allergens,
      }));
    }
  }

  async updateIngredient(params: {
    tenantId: string;
    ingredientId: string;
    name?: string;
    sku?: string;
    category?: string;
    costPerUnit?: number;
    minimumStockLevel?: number;
    reorderPoint?: number;
    reorderQuantity?: number;
    allergens?: string[];
  }): Promise<Ingredient> {
    const { tenantId, ingredientId, ...updates } = params;
    const existing = await this.getIngredient(tenantId, ingredientId);
    if (!existing) throw new Error("Ingredient not found");

    const updatedData: any = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("ingredients", ingredientId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE ingredients SET
          name = COALESCE($1, name),
          sku = COALESCE($2, sku),
          category = COALESCE($3, category),
          cost_per_unit = COALESCE($4, cost_per_unit),
          minimum_stock_level = COALESCE($5, minimum_stock_level),
          reorder_point = COALESCE($6, reorder_point),
          reorder_quantity = COALESCE($7, reorder_quantity),
          allergens = COALESCE($8, allergens),
          updated_at = NOW()
        WHERE id = $9 AND tenant_id = $10`,
        [
          updates.name || null,
          updates.sku || null,
          updates.category || null,
          updates.costPerUnit || null,
          updates.minimumStockLevel ?? null,
          updates.reorderPoint ?? null,
          updates.reorderQuantity ?? null,
          updates.allergens ? JSON.stringify(updates.allergens) : null,
          ingredientId,
          tenantId,
        ]
      );
    }

    return updatedData;
  }

  /**
   * Get or create stock record for warehouse + ingredient
   */
  async getOrCreateStock(
    tenantId: string,
    warehouseId: string,
    ingredientId: string
  ): Promise<InventoryStock> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      let stock = memoryDb.find(
        "inventory_stocks",
        (s: any) =>
          s.tenant_id === tenantId &&
          s.warehouse_id === warehouseId &&
          s.ingredient_id === ingredientId
      )[0];

      if (!stock) {
        stock = {
          id: `stk_${crypto.randomUUID()}`,
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          ingredient_id: ingredientId,
          quantity: 0.0,
          reserved_quantity: 0.0,
          available_quantity: 0.0,
          last_counted_at: null,
          updated_at: new Date(),
        };
        memoryDb.insert("inventory_stocks", stock);
      }
      return stock;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM inventory_stocks WHERE tenant_id = $1 AND warehouse_id = $2 AND ingredient_id = $3",
        [tenantId, warehouseId, ingredientId]
      );
      if (res.rows.length > 0) return res.rows[0];

      const id = `stk_${crypto.randomUUID()}`;
      const insertRes = await pool.query(
        `INSERT INTO inventory_stocks (
          id, tenant_id, warehouse_id, ingredient_id, quantity, reserved_quantity, available_quantity, updated_at
        ) VALUES ($1, $2, $3, $4, 0.0, 0.0, 0.0, NOW()) RETURNING *`,
        [id, tenantId, warehouseId, ingredientId]
      );
      return insertRes.rows[0];
    }
  }

  /**
   * Record atomic stock movement & update inventory stock balance
   * Prevents negative inventory unless explicitly permitted by branch setting.
   */
  async adjustStock(params: {
    tenantId: string;
    warehouseId: string;
    ingredientId: string;
    adjustmentQuantity: number; // positive = add, negative = deduct
    unitId: string;
    movementType?: MovementType;
    reason?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    idempotencyKey?: string | null;
    actorId?: string | null;
    allowNegative?: boolean;
  }): Promise<{ stock: InventoryStock; movement: StockMovement }> {
    const {
      tenantId,
      warehouseId,
      ingredientId,
      adjustmentQuantity,
      unitId,
      movementType = "COUNT_ADJUSTMENT",
      reason,
      referenceType = "MANUAL",
      referenceId,
      idempotencyKey,
      actorId,
      allowNegative = false,
    } = params;

    // Check idempotency if key provided
    if (idempotencyKey) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const existingMovement = memoryDb.find(
          "stock_movements",
          (m: any) => m.tenant_id === tenantId && m.idempotency_key === idempotencyKey
        )[0];
        if (existingMovement) {
          const stock = await this.getOrCreateStock(tenantId, warehouseId, ingredientId);
          return { stock, movement: existingMovement };
        }
      } else {
        const pool = getPostgresPool();
        const res = await pool.query(
          "SELECT * FROM stock_movements WHERE tenant_id = $1 AND idempotency_key = $2",
          [tenantId, idempotencyKey]
        );
        if (res.rows.length > 0) {
          const stock = await this.getOrCreateStock(tenantId, warehouseId, ingredientId);
          return { stock, movement: res.rows[0] };
        }
      }
    }

    const ingredient = await this.getIngredient(tenantId, ingredientId);
    if (!ingredient) throw new Error("Ingredient not found");

    // Convert adjustment quantity to ingredient primary unit
    let normalizedQuantity = adjustmentQuantity;
    if (unitId !== ingredient.primary_unit_id) {
      normalizedQuantity = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: unitId,
        toUnitId: ingredient.primary_unit_id,
        quantity: adjustmentQuantity,
      });
    }

    const currentStock = await this.getOrCreateStock(tenantId, warehouseId, ingredientId);
    const newQuantity = Number((Number(currentStock.quantity) + normalizedQuantity).toFixed(4));

    // Negative stock guard
    if (newQuantity < 0 && !allowNegative) {
      throw new Error(
        `Insufficient stock for '${ingredient.name}'. Current: ${currentStock.quantity} ${ingredient.primary_unit_id}, Requested reduction: ${Math.abs(normalizedQuantity)} ${ingredient.primary_unit_id}. Negative stock is not permitted.`
      );
    }

    const newAvailable = Number((newQuantity - Number(currentStock.reserved_quantity || 0)).toFixed(4));
    const now = new Date();

    const unitCost = Number(ingredient.cost_per_unit || 0);
    const totalCost = Number((Math.abs(normalizedQuantity) * unitCost).toFixed(2));

    const movement: StockMovement = {
      id: `mov_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      ingredient_id: ingredientId,
      source_warehouse_id: normalizedQuantity < 0 ? warehouseId : null,
      destination_warehouse_id: normalizedQuantity > 0 ? warehouseId : null,
      movement_type: movementType,
      quantity: Number(Math.abs(normalizedQuantity).toFixed(4)),
      unit_id: ingredient.primary_unit_id,
      unit_cost: unitCost,
      total_cost: totalCost,
      reference_type: referenceType,
      reference_id: referenceId || null,
      idempotency_key: idempotencyKey || null,
      actor_id: actorId || null,
      notes: reason || null,
      created_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("inventory_stocks", currentStock.id, {
        quantity: newQuantity,
        available_quantity: newAvailable,
        updated_at: now,
      });
      memoryDb.insert("stock_movements", movement);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE inventory_stocks SET
          quantity = $1, available_quantity = $2, updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [newQuantity, newAvailable, currentStock.id, tenantId]
      );

      await pool.query(
        `INSERT INTO stock_movements (
          id, tenant_id, ingredient_id, source_warehouse_id, destination_warehouse_id,
          movement_type, quantity, unit_id, unit_cost, total_cost, reference_type,
          reference_id, idempotency_key, actor_id, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
        [
          movement.id,
          movement.tenant_id,
          movement.ingredient_id,
          movement.source_warehouse_id,
          movement.destination_warehouse_id,
          movement.movement_type,
          movement.quantity,
          movement.unit_id,
          movement.unit_cost,
          movement.total_cost,
          movement.reference_type,
          movement.reference_id,
          movement.idempotency_key,
          movement.actor_id,
          movement.notes,
        ]
      );
    }

    await auditLogger.log({
      actor: { actorId: actorId || "SYSTEM", actorType: actorId ? "USER" : "SYSTEM" },
      action: "STOCK_ADJUSTED",
      entity: "InventoryStock",
      entityId: currentStock.id,
      metadata: {
        ingredientId,
        warehouseId,
        previousQuantity: currentStock.quantity,
        newQuantity,
        movementType,
      },
    });

    const updatedStock: InventoryStock = {
      ...currentStock,
      quantity: newQuantity,
      available_quantity: newAvailable,
      updated_at: now,
    };

    return { stock: updatedStock, movement };
  }

  /**
   * Order Depletion Engine (PHASE 00 Section 34 & ARCHITECTURE.md Section 7)
   * Evaluates branch policy (ON_ACCEPTED, ON_PREPARATION_START, ON_FULFILLMENT),
   * calculates BOM explosion for all items/modifiers, and decrements stock.
   */
  async depleteStockForOrder(params: {
    tenantId: string;
    branchId: string;
    orderId: string;
    trigger: DepletionPolicy;
    actorId?: string | null;
  }): Promise<{ depleted: boolean; movementsCount: number }> {
    const { tenantId, branchId, orderId, trigger, actorId } = params;

    // 1. Resolve branch depletion policy (default: ON_ACCEPTED)
    const activePolicy = await this.getBranchDepletionPolicy(tenantId, branchId);
    if (activePolicy !== trigger) {
      return { depleted: false, movementsCount: 0 };
    }

    // 2. Resolve default kitchen prep warehouse for this branch
    const kitchenWarehouse = await this.getKitchenWarehouse(tenantId, branchId);
    if (!kitchenWarehouse) {
      return { depleted: false, movementsCount: 0 };
    }

    // 3. Fetch order items
    const orderItems = await this.getOrderItems(tenantId, orderId);
    if (orderItems.length === 0) {
      return { depleted: false, movementsCount: 0 };
    }

    let movementsCount = 0;

    // 4. For each order item, explode BOM and deplete stock
    for (const item of orderItems) {
      const selectedModifierIds: string[] = [];
      if (item.selected_modifiers && Array.isArray(item.selected_modifiers)) {
        for (const mod of item.selected_modifiers) {
          if (mod.modifier_id) selectedModifierIds.push(mod.modifier_id);
        }
      }

      const bom = await recipeService.calculateBOM({
        tenantId,
        productId: item.product_id,
        variantId: item.variant_id,
        selectedModifierIds,
        quantity: item.quantity,
      });

      for (const bomItem of bom.items) {
        const idempotencyKey = `deplete_${orderId}_${item.id}_${bomItem.ingredientId}_${trigger}`;

        await this.adjustStock({
          tenantId,
          warehouseId: kitchenWarehouse.id,
          ingredientId: bomItem.ingredientId,
          adjustmentQuantity: -bomItem.quantity, // Negative for sale deduction
          unitId: bomItem.unitId,
          movementType: "SALE_DEPLETION",
          reason: `Order ${orderId} item ${item.name}`,
          referenceType: "ORDER",
          referenceId: orderId,
          idempotencyKey,
          actorId,
          allowNegative: true, // Allow kitchen line to continue service even if stock record lags
        });

        movementsCount++;
      }
    }

    return { depleted: true, movementsCount };
  }

  /**
   * Order Cancellation Rollback (PHASE 00 Section 34)
   * Restores any previously depleted stock for this order.
   */
  async rollbackStockForOrder(params: {
    tenantId: string;
    branchId: string;
    orderId: string;
    actorId?: string | null;
    reason?: string | null;
  }): Promise<{ restored: boolean; movementsCount: number }> {
    const { tenantId, orderId, actorId, reason = "Order cancelled" } = params;

    // Find all SALE_DEPLETION movements recorded for this order
    let depletionMovements: StockMovement[] = [];
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      depletionMovements = memoryDb.find(
        "stock_movements",
        (m: any) =>
          m.tenant_id === tenantId &&
          m.reference_type === "ORDER" &&
          m.reference_id === orderId &&
          m.movement_type === "SALE_DEPLETION"
      );
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM stock_movements
         WHERE tenant_id = $1 AND reference_type = 'ORDER' AND reference_id = $2 AND movement_type = 'SALE_DEPLETION'`,
        [tenantId, orderId]
      );
      depletionMovements = res.rows;
    }

    if (depletionMovements.length === 0) {
      return { restored: false, movementsCount: 0 };
    }

    let restoredCount = 0;

    for (const dep of depletionMovements) {
      const rollbackWarehouseId = dep.source_warehouse_id || dep.destination_warehouse_id;
      if (!rollbackWarehouseId) continue;

      const idempotencyKey = `rollback_${dep.id}`;

      await this.adjustStock({
        tenantId,
        warehouseId: rollbackWarehouseId,
        ingredientId: dep.ingredient_id,
        adjustmentQuantity: dep.quantity, // Positive restoration
        unitId: dep.unit_id,
        movementType: "SALE_ROLLBACK",
        reason: `Rollback for ${orderId}: ${reason}`,
        referenceType: "ORDER",
        referenceId: orderId,
        idempotencyKey,
        actorId,
        allowNegative: true,
      });

      restoredCount++;
    }

    return { restored: true, movementsCount: restoredCount };
  }

  /**
   * List low stock threshold alerts
   */
  async getLowStockAlerts(
    tenantId: string,
    branchId: string
  ): Promise<
    Array<{
      ingredient: Ingredient;
      warehouse: any;
      currentQuantity: number;
      reorderPoint: number;
      reorderQuantity: number;
      isCritical: boolean;
    }>
  > {
    const alerts: any[] = [];
    const ingredients = await this.listIngredients(tenantId);

    for (const ing of ingredients) {
      if (ing.reorder_point <= 0 && ing.minimum_stock_level <= 0) continue;

      // Sum quantities across branch warehouses
      const stocks = await this.listStockLevels(tenantId);
      const ingStocks = stocks.filter((s) => s.ingredient_id === ing.id);
      const totalAvailable = ingStocks.reduce((sum, s) => sum + Number(s.available_quantity || 0), 0);

      if (totalAvailable <= ing.reorder_point || totalAvailable <= ing.minimum_stock_level) {
        alerts.push({
          ingredient: ing,
          warehouse: ingStocks[0]?.warehouse || null,
          currentQuantity: totalAvailable,
          reorderPoint: ing.reorder_point,
          reorderQuantity: ing.reorder_quantity,
          isCritical: totalAvailable <= ing.minimum_stock_level,
        });
      }
    }

    return alerts;
  }

  async listStockLevels(tenantId: string, warehouseId?: string): Promise<InventoryStock[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const stocks = memoryDb.find(
        "inventory_stocks",
        (s: any) => s.tenant_id === tenantId && (!warehouseId || s.warehouse_id === warehouseId)
      );

      return stocks.map((s: any) => ({
        ...s,
        ingredient: memoryDb.findById("ingredients", s.ingredient_id),
        warehouse: memoryDb.findById("warehouses", s.warehouse_id),
      }));
    } else {
      const pool = getPostgresPool();
      const query = warehouseId
        ? `SELECT s.*, row_to_json(i.*) as ingredient, row_to_json(w.*) as warehouse
           FROM inventory_stocks s
           JOIN ingredients i ON s.ingredient_id = i.id
           JOIN warehouses w ON s.warehouse_id = w.id
           WHERE s.tenant_id = $1 AND s.warehouse_id = $2`
        : `SELECT s.*, row_to_json(i.*) as ingredient, row_to_json(w.*) as warehouse
           FROM inventory_stocks s
           JOIN ingredients i ON s.ingredient_id = i.id
           JOIN warehouses w ON s.warehouse_id = w.id
           WHERE s.tenant_id = $1`;
      const params = warehouseId ? [tenantId, warehouseId] : [tenantId];
      const res = await pool.query(query, params);
      return res.rows;
    }
  }

  private async getBranchDepletionPolicy(
    tenantId: string,
    branchId: string
  ): Promise<DepletionPolicy> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const branch = memoryDb.findById("branches", branchId);
      return branch?.operational_settings?.inventoryDepletionPolicy || "ON_ACCEPTED";
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT operational_settings FROM branches WHERE id = $1 AND organization_id = $2",
        [branchId, tenantId]
      );
      return res.rows[0]?.operational_settings?.inventoryDepletionPolicy || "ON_ACCEPTED";
    }
  }

  private async getKitchenWarehouse(tenantId: string, branchId: string): Promise<any> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const warehouses = memoryDb.find(
        "warehouses",
        (w: any) =>
          w.tenant_id === tenantId &&
          w.branch_id === branchId &&
          w.is_active
      );
      const kitchen = warehouses.find((w: any) => w.warehouse_type === "KITCHEN");
      if (kitchen) return kitchen;
      const main = warehouses.find((w: any) => w.warehouse_type === "MAIN_WAREHOUSE");
      return main || warehouses[0] || null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM warehouses
         WHERE tenant_id = $1 AND branch_id = $2 AND warehouse_type IN ('KITCHEN', 'MAIN_WAREHOUSE') AND is_active = true
         ORDER BY (warehouse_type = 'KITCHEN') DESC LIMIT 1`,
        [tenantId, branchId]
      );
      return res.rows.length > 0 ? res.rows[0] : null;
    }
  }

  private async getOrderItems(tenantId: string, orderId: string): Promise<any[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find("order_items", (oi: any) => oi.order_id === orderId);
    } else {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
      return res.rows.map((row) => ({
        ...row,
        selected_modifiers:
          typeof row.selected_modifiers === "string" ? JSON.parse(row.selected_modifiers) : row.selected_modifiers,
      }));
    }
  }
}

export const inventoryService = new InventoryService();
