import { memoryDb, getPostgresPool } from "@/core/database/db";
import { WasteRecord, WasteReason } from "../domain/inventory";
import { inventoryService } from "./inventory-service";
import { unitConversionService } from "./unit-conversion-service";
import { auditLogger } from "@/core/audit/audit-logger";

export class WasteService {
  /**
   * Record inventory waste / spoilage / prep mistake
   */
  async recordWaste(params: {
    tenantId: string;
    branchId: string;
    warehouseId: string;
    ingredientId: string;
    quantity: number;
    unitId: string;
    wasteReason: WasteReason;
    notes?: string | null;
    reportedBy?: string | null;
  }): Promise<WasteRecord> {
    const {
      tenantId,
      branchId,
      warehouseId,
      ingredientId,
      quantity,
      unitId,
      wasteReason,
      notes,
      reportedBy,
    } = params;

    const ingredient = await inventoryService.getIngredient(tenantId, ingredientId);
    if (!ingredient) throw new Error("Ingredient not found");

    // Convert quantity to ingredient primary unit for accurate cost evaluation
    let normalizedQuantity = quantity;
    if (unitId !== ingredient.primary_unit_id) {
      normalizedQuantity = await unitConversionService.convertQuantity({
        tenantId,
        fromUnitId: unitId,
        toUnitId: ingredient.primary_unit_id,
        quantity,
      });
    }

    const costImpact = Number((normalizedQuantity * Number(ingredient.cost_per_unit || 0)).toFixed(2));
    const wasteId = `wst_${crypto.randomUUID()}`;
    const now = new Date();

    const record: WasteRecord = {
      id: wasteId,
      tenant_id: tenantId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      ingredient_id: ingredientId,
      quantity,
      unit_id: unitId,
      waste_reason: wasteReason,
      cost_impact: costImpact,
      reported_by: reportedBy || null,
      notes: notes || null,
      created_at: now,
    };

    // Deduct stock from warehouse
    await inventoryService.adjustStock({
      tenantId,
      warehouseId,
      ingredientId,
      adjustmentQuantity: -quantity, // Deduct
      unitId,
      movementType: "WASTE",
      reason: `Waste reported: ${wasteReason}${notes ? ` (${notes})` : ""}`,
      referenceType: "WASTE_REPORT",
      referenceId: wasteId,
      actorId: reportedBy,
      allowNegative: true,
    });

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("waste_records", record);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO waste_records (
          id, tenant_id, branch_id, warehouse_id, ingredient_id, quantity, unit_id,
          waste_reason, cost_impact, reported_by, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          record.id,
          record.tenant_id,
          record.branch_id,
          record.warehouse_id,
          record.ingredient_id,
          record.quantity,
          record.unit_id,
          record.waste_reason,
          record.cost_impact,
          record.reported_by,
          record.notes,
        ]
      );
    }

    await auditLogger.log({
      actor: { actorId: reportedBy || "SYSTEM", actorType: reportedBy ? "USER" : "SYSTEM" },
      action: "WASTE_RECORDED",
      entity: "WasteRecord",
      entityId: wasteId,
      metadata: { ingredientId, warehouseId, quantity, wasteReason, costImpact },
    });

    return record;
  }

  async listWasteRecords(tenantId: string, branchId?: string): Promise<WasteRecord[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find(
        "waste_records",
        (w: any) => w.tenant_id === tenantId && (!branchId || w.branch_id === branchId)
      );
    } else {
      const pool = getPostgresPool();
      const query = branchId
        ? "SELECT * FROM waste_records WHERE tenant_id = $1 AND branch_id = $2 ORDER BY created_at DESC"
        : "SELECT * FROM waste_records WHERE tenant_id = $1 ORDER BY created_at DESC";
      const params = branchId ? [tenantId, branchId] : [tenantId];
      const res = await pool.query(query, params);
      return res.rows;
    }
  }

  async getWasteSummary(
    tenantId: string,
    filters?: { branchId?: string; warehouseId?: string }
  ): Promise<{
    totalCostImpact: number;
    countByReason: Record<string, number>;
    costByReason: Record<string, number>;
  }> {
    const records = await this.listWasteRecords(tenantId, filters?.branchId);
    const filtered = filters?.warehouseId
      ? records.filter((r) => r.warehouse_id === filters.warehouseId)
      : records;

    let totalCostImpact = 0;
    const countByReason: Record<string, number> = {};
    const costByReason: Record<string, number> = {};

    for (const r of filtered) {
      const cost = Number(r.cost_impact || 0);
      totalCostImpact += cost;
      countByReason[r.waste_reason] = (countByReason[r.waste_reason] || 0) + 1;
      costByReason[r.waste_reason] = Number(
        ((costByReason[r.waste_reason] || 0) + cost).toFixed(2)
      );
    }

    return {
      totalCostImpact: Number(totalCostImpact.toFixed(2)),
      countByReason,
      costByReason,
    };
  }
}

export const wasteService = new WasteService();
