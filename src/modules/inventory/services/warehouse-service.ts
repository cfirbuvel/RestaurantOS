import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  Warehouse,
  WarehouseType,
  StorageLocation,
  InventoryTransfer,
  InventoryTransferItem,
} from "../domain/inventory";
import { inventoryService } from "./inventory-service";
import { auditLogger } from "@/core/audit/audit-logger";

export class WarehouseService {
  /**
   * Create a warehouse / storage facility
   */
  async createWarehouse(
    tenantId: string,
    branchId: string,
    params: {
      name: string;
      warehouseType: WarehouseType;
    }
  ): Promise<Warehouse> {
    const warehouseId = `wh_${crypto.randomUUID()}`;
    const now = new Date();

    const warehouse: Warehouse = {
      id: warehouseId,
      tenant_id: tenantId,
      branch_id: branchId,
      name: params.name,
      warehouse_type: params.warehouseType,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("warehouses", warehouse);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO warehouses (id, tenant_id, branch_id, name, warehouse_type, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          warehouse.id,
          warehouse.tenant_id,
          warehouse.branch_id,
          warehouse.name,
          warehouse.warehouse_type,
          warehouse.is_active,
        ]
      );
    }

    return warehouse;
  }

  async getWarehouse(tenantId: string, warehouseId: string): Promise<Warehouse | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const wh = memoryDb.findById("warehouses", warehouseId);
      return wh && wh.tenant_id === tenantId ? wh : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM warehouses WHERE id = $1 AND tenant_id = $2",
        [warehouseId, tenantId]
      );
      return res.rows.length > 0 ? res.rows[0] : null;
    }
  }

  async listWarehouses(tenantId: string, branchId?: string): Promise<Warehouse[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find(
        "warehouses",
        (w: any) => w.tenant_id === tenantId && (!branchId || w.branch_id === branchId) && w.is_active
      );
    } else {
      const pool = getPostgresPool();
      const query = branchId
        ? "SELECT * FROM warehouses WHERE tenant_id = $1 AND branch_id = $2 AND is_active = true ORDER BY name ASC"
        : "SELECT * FROM warehouses WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC";
      const params = branchId ? [tenantId, branchId] : [tenantId];
      const res = await pool.query(query, params);
      return res.rows;
    }
  }

  /**
   * Create an inter-warehouse / commissary transfer request
   */
  async createTransfer(params: {
    tenantId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    items: Array<{ ingredientId: string; quantity: number; unitId: string }>;
    requestedBy?: string | null;
    notes?: string | null;
  }): Promise<InventoryTransfer> {
    const { tenantId, sourceWarehouseId, destinationWarehouseId, items, requestedBy, notes } = params;

    if (sourceWarehouseId === destinationWarehouseId) {
      throw new Error("Source and destination warehouses cannot be the same.");
    }

    const transferId = `trf_${crypto.randomUUID()}`;
    const transferNumber = `TRF-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const transfer: InventoryTransfer = {
      id: transferId,
      tenant_id: tenantId,
      transfer_number: transferNumber,
      source_warehouse_id: sourceWarehouseId,
      destination_warehouse_id: destinationWarehouseId,
      status: "REQUESTED",
      requested_by: requestedBy || null,
      approved_by: null,
      dispatched_at: null,
      completed_at: null,
      notes: notes || null,
      created_at: now,
      updated_at: now,
    };

    const transferItems: InventoryTransferItem[] = items.map((it) => ({
      id: `tri_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      transfer_id: transferId,
      ingredient_id: it.ingredientId,
      quantity: it.quantity,
      unit_id: it.unitId,
      received_quantity: null,
      created_at: now,
    }));

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("inventory_transfers", transfer);
      for (const it of transferItems) {
        memoryDb.insert("inventory_transfer_items", it);
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO inventory_transfers (
          id, tenant_id, transfer_number, source_warehouse_id, destination_warehouse_id,
          status, requested_by, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6, $7, NOW(), NOW())`,
        [
          transfer.id,
          transfer.tenant_id,
          transfer.transfer_number,
          transfer.source_warehouse_id,
          transfer.destination_warehouse_id,
          transfer.requested_by,
          transfer.notes,
        ]
      );

      for (const it of transferItems) {
        await pool.query(
          `INSERT INTO inventory_transfer_items (id, tenant_id, transfer_id, ingredient_id, quantity, unit_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [it.id, it.tenant_id, it.transfer_id, it.ingredient_id, it.quantity, it.unit_id]
        );
      }
    }

    transfer.items = transferItems;
    return transfer;
  }

  /**
   * Approve and dispatch transfer -> deducts stock from source warehouse
   */
  async approveAndDispatchTransfer(
    tenantId: string,
    transferId: string,
    approvedBy: string
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(tenantId, transferId);
    if (!transfer) throw new Error("Transfer not found");

    if (transfer.status !== "REQUESTED") {
      throw new Error(`Cannot approve transfer in status '${transfer.status}'.`);
    }

    const now = new Date();

    // Deduct stock from source warehouse
    if (transfer.items) {
      for (const item of transfer.items) {
        await inventoryService.adjustStock({
          tenantId,
          warehouseId: transfer.source_warehouse_id,
          ingredientId: item.ingredient_id,
          adjustmentQuantity: -item.quantity, // Deduct from source
          unitId: item.unit_id,
          movementType: "TRANSFER_OUT",
          reason: `Transfer ${transfer.transfer_number} dispatched`,
          referenceType: "TRANSFER",
          referenceId: transfer.id,
          actorId: approvedBy,
        });
      }
    }

    const updatedData: Partial<InventoryTransfer> = {
      status: "IN_TRANSIT",
      approved_by: approvedBy,
      dispatched_at: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("inventory_transfers", transferId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE inventory_transfers SET status = 'IN_TRANSIT', approved_by = $1, dispatched_at = $2, updated_at = $2
         WHERE id = $3 AND tenant_id = $4`,
        [approvedBy, now, transferId, tenantId]
      );
    }

    return { ...transfer, ...updatedData };
  }

  /**
   * Complete transfer -> credits stock to destination warehouse
   */
  async completeTransfer(
    tenantId: string,
    transferId: string,
    completedBy: string
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(tenantId, transferId);
    if (!transfer) throw new Error("Transfer not found");

    if (transfer.status !== "IN_TRANSIT" && transfer.status !== "APPROVED") {
      throw new Error(`Cannot complete transfer in status '${transfer.status}'. Must be IN_TRANSIT.`);
    }

    const now = new Date();

    // Credit stock to destination warehouse
    if (transfer.items) {
      for (const item of transfer.items) {
        await inventoryService.adjustStock({
          tenantId,
          warehouseId: transfer.destination_warehouse_id,
          ingredientId: item.ingredient_id,
          adjustmentQuantity: item.quantity, // Add to destination
          unitId: item.unit_id,
          movementType: "TRANSFER_IN",
          reason: `Transfer ${transfer.transfer_number} completed`,
          referenceType: "TRANSFER",
          referenceId: transfer.id,
          actorId: completedBy,
        });
      }
    }

    const updatedData: Partial<InventoryTransfer> = {
      status: "COMPLETED",
      completed_at: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("inventory_transfers", transferId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE inventory_transfers SET status = 'COMPLETED', completed_at = $1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3`,
        [now, transferId, tenantId]
      );
    }

    return { ...transfer, ...updatedData };
  }

  async getTransfer(tenantId: string, transferId: string): Promise<InventoryTransfer | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const transfer = memoryDb.findById("inventory_transfers", transferId);
      if (!transfer || transfer.tenant_id !== tenantId) return null;
      const items = memoryDb.find(
        "inventory_transfer_items",
        (ti: any) => ti.tenant_id === tenantId && ti.transfer_id === transferId
      );
      return { ...transfer, items };
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM inventory_transfers WHERE id = $1 AND tenant_id = $2",
        [transferId, tenantId]
      );
      if (res.rows.length === 0) return null;
      const transfer = res.rows[0];

      const itemsRes = await pool.query(
        "SELECT * FROM inventory_transfer_items WHERE transfer_id = $1 AND tenant_id = $2",
        [transferId, tenantId]
      );
      transfer.items = itemsRes.rows;
      return transfer;
    }
  }

  async listTransfers(tenantId: string): Promise<InventoryTransfer[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const list = memoryDb.find("inventory_transfers", (t: any) => t.tenant_id === tenantId);
      return list.map((t: any) => ({
        ...t,
        items: memoryDb.find(
          "inventory_transfer_items",
          (ti: any) => ti.tenant_id === tenantId && ti.transfer_id === t.id
        ),
      }));
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM inventory_transfers WHERE tenant_id = $1 ORDER BY created_at DESC",
        [tenantId]
      );
      return res.rows;
    }
  }
}

export const warehouseService = new WarehouseService();
