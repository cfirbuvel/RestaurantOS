import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  Supplier,
  SupplierItem,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
} from "../domain/inventory";
import { inventoryService } from "./inventory-service";
import { auditLogger } from "@/core/audit/audit-logger";

export class SupplierService {
  /**
   * Create a new supplier
   */
  async createSupplier(params: {
    tenantId: string;
    name: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    paymentTerms?: string | null;
    leadTimeDays?: number;
    taxId?: string | null;
  }): Promise<Supplier> {
    const { tenantId, name, contactName, email, phone, paymentTerms, leadTimeDays = 1, taxId } = params;

    const supplierId = `sup_${crypto.randomUUID()}`;
    const now = new Date();

    const supplier: Supplier = {
      id: supplierId,
      tenant_id: tenantId,
      name,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      payment_terms: paymentTerms || null,
      lead_time_days: leadTimeDays,
      tax_id: taxId || null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("suppliers", supplier);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO suppliers (
          id, tenant_id, name, contact_name, email, phone, payment_terms, lead_time_days, tax_id, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())`,
        [
          supplier.id,
          supplier.tenant_id,
          supplier.name,
          supplier.contact_name,
          supplier.email,
          supplier.phone,
          supplier.payment_terms,
          supplier.lead_time_days,
          supplier.tax_id,
        ]
      );
    }

    return supplier;
  }

  async getSupplier(tenantId: string, supplierId: string): Promise<Supplier | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const sup = memoryDb.findById("suppliers", supplierId);
      return sup && sup.tenant_id === tenantId ? sup : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM suppliers WHERE id = $1 AND tenant_id = $2",
        [supplierId, tenantId]
      );
      return res.rows.length > 0 ? res.rows[0] : null;
    }
  }

  async listSuppliers(tenantId: string): Promise<Supplier[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find("suppliers", (s: any) => s.tenant_id === tenantId && s.is_active);
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM suppliers WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC",
        [tenantId]
      );
      return res.rows;
    }
  }

  /**
   * Create a Purchase Order (PO)
   */
  async createPurchaseOrder(params: {
    tenantId: string;
    branchId: string;
    supplierId: string;
    destinationWarehouseId: string;
    items: Array<{
      ingredientId: string;
      orderedQuantity: number;
      unitId: string;
      unitPrice: number;
    }>;
    expectedDeliveryDate?: string | Date | null;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<PurchaseOrder> {
    const {
      tenantId,
      branchId,
      supplierId,
      destinationWarehouseId,
      items,
      expectedDeliveryDate,
      notes,
      createdBy,
    } = params;

    const poId = `po_${crypto.randomUUID()}`;
    const poNumber = `PO-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date();

    let totalAmount = 0;
    const poItems: PurchaseOrderItem[] = items.map((it) => {
      const totalPrice = Number((it.orderedQuantity * it.unitPrice).toFixed(2));
      totalAmount += totalPrice;

      return {
        id: `poi_${crypto.randomUUID()}`,
        tenant_id: tenantId,
        purchase_order_id: poId,
        ingredient_id: it.ingredientId,
        ordered_quantity: it.orderedQuantity,
        received_quantity: 0.0,
        unit_id: it.unitId,
        unit_price: it.unitPrice,
        total_price: totalPrice,
        created_at: now,
      };
    });

    const po: PurchaseOrder = {
      id: poId,
      tenant_id: tenantId,
      branch_id: branchId,
      supplier_id: supplierId,
      destination_warehouse_id: destinationWarehouseId,
      po_number: poNumber,
      status: "DRAFT",
      total_amount: Number(totalAmount.toFixed(2)),
      currency: "ILS",
      expected_delivery_date: expectedDeliveryDate || null,
      submitted_at: null,
      received_at: null,
      notes: notes || null,
      created_by: createdBy || null,
      created_at: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("purchase_orders", po);
      for (const it of poItems) {
        memoryDb.insert("purchase_order_items", it);
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO purchase_orders (
          id, tenant_id, branch_id, supplier_id, destination_warehouse_id, po_number,
          status, total_amount, currency, expected_delivery_date, notes, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, 'ILS', $8, $9, $10, NOW(), NOW())`,
        [
          po.id,
          po.tenant_id,
          po.branch_id,
          po.supplier_id,
          po.destination_warehouse_id,
          po.po_number,
          po.total_amount,
          po.expected_delivery_date,
          po.notes,
          po.created_by,
        ]
      );

      for (const it of poItems) {
        await pool.query(
          `INSERT INTO purchase_order_items (
            id, tenant_id, purchase_order_id, ingredient_id, ordered_quantity, received_quantity,
            unit_id, unit_price, total_price, created_at
          ) VALUES ($1, $2, $3, $4, $5, 0.0, $6, $7, $8, NOW())`,
          [it.id, it.tenant_id, it.purchase_order_id, it.ingredient_id, it.ordered_quantity, it.unit_id, it.unit_price, it.total_price]
        );
      }
    }

    po.items = poItems;
    return po;
  }

  /**
   * Submit PO to supplier
   */
  async submitPurchaseOrder(tenantId: string, poId: string, submittedBy: string): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(tenantId, poId);
    if (!po) throw new Error("Purchase order not found");
    if (po.status !== "DRAFT") throw new Error(`Cannot submit PO in status '${po.status}'.`);

    const now = new Date();
    const updatedData: Partial<PurchaseOrder> = {
      status: "SUBMITTED",
      submitted_at: now,
      updated_at: now,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("purchase_orders", poId, updatedData);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        "UPDATE purchase_orders SET status = 'SUBMITTED', submitted_at = $1, updated_at = $1 WHERE id = $2 AND tenant_id = $3",
        [now, poId, tenantId]
      );
    }

    await auditLogger.log({
      actor: { actorId: submittedBy, actorType: "USER" },
      action: "PURCHASE_ORDER_SUBMITTED",
      entity: "PurchaseOrder",
      entityId: poId,
      metadata: { poNumber: po.po_number, totalAmount: po.total_amount },
    });

    return { ...po, ...updatedData };
  }

  /**
   * Idempotent Goods Receiving (RECEIPT):
   * Increments stock in the destination warehouse and records goods receipt.
   */
  async receiveGoods(params: {
    tenantId: string;
    purchaseOrderId?: string | null;
    warehouseId: string;
    items: Array<{
      ingredientId: string;
      quantity: number;
      unitId: string;
      unitCost: number;
    }>;
    idempotencyKey?: string | null;
    receivedBy?: string | null;
    notes?: string | null;
  }): Promise<GoodsReceipt> {
    const { tenantId, purchaseOrderId, warehouseId, items, idempotencyKey, receivedBy, notes } = params;

    // Check idempotency
    if (idempotencyKey) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const existing = memoryDb.find(
          "goods_receipts",
          (r: any) => r.tenant_id === tenantId && r.idempotency_key === idempotencyKey
        )[0];
        if (existing) {
          existing.items = memoryDb.find(
            "goods_receipt_items",
            (ri: any) => ri.goods_receipt_id === existing.id
          );
          return existing;
        }
      } else {
        const pool = getPostgresPool();
        const res = await pool.query(
          "SELECT * FROM goods_receipts WHERE tenant_id = $1 AND idempotency_key = $2",
          [tenantId, idempotencyKey]
        );
        if (res.rows.length > 0) {
          const receipt = res.rows[0];
          const itemsRes = await pool.query(
            "SELECT * FROM goods_receipt_items WHERE goods_receipt_id = $1",
            [receipt.id]
          );
          receipt.items = itemsRes.rows;
          return receipt;
        }
      }
    }

    const receiptId = `rcpt_${crypto.randomUUID()}`;
    const receiptNumber = `GR-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date();

    const receipt: GoodsReceipt = {
      id: receiptId,
      tenant_id: tenantId,
      purchase_order_id: purchaseOrderId || null,
      warehouse_id: warehouseId,
      receipt_number: receiptNumber,
      idempotency_key: idempotencyKey || null,
      received_by: receivedBy || null,
      received_at: now,
      notes: notes || null,
    };

    const receiptItems: GoodsReceiptItem[] = items.map((it) => ({
      id: `gri_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      goods_receipt_id: receiptId,
      ingredient_id: it.ingredientId,
      quantity: it.quantity,
      unit_id: it.unitId,
      unit_cost: it.unitCost,
      created_at: now,
    }));

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("goods_receipts", receipt);
      for (const it of receiptItems) {
        memoryDb.insert("goods_receipt_items", it);
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO goods_receipts (
          id, tenant_id, purchase_order_id, warehouse_id, receipt_number, idempotency_key, received_by, received_at, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
        [
          receipt.id,
          receipt.tenant_id,
          receipt.purchase_order_id,
          receipt.warehouse_id,
          receipt.receipt_number,
          receipt.idempotency_key,
          receipt.received_by,
          receipt.notes,
        ]
      );

      for (const it of receiptItems) {
        await pool.query(
          `INSERT INTO goods_receipt_items (id, tenant_id, goods_receipt_id, ingredient_id, quantity, unit_id, unit_cost, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [it.id, it.tenant_id, it.goods_receipt_id, it.ingredient_id, it.quantity, it.unit_id, it.unit_cost]
        );
      }
    }

    // Increment inventory stock for each received item
    for (const it of items) {
      await inventoryService.adjustStock({
        tenantId,
        warehouseId,
        ingredientId: it.ingredientId,
        adjustmentQuantity: it.quantity, // Positive for receipt
        unitId: it.unitId,
        movementType: "RECEIPT",
        reason: `Goods receipt ${receiptNumber}${purchaseOrderId ? ` for PO ${purchaseOrderId}` : ""}`,
        referenceType: "PURCHASE_ORDER",
        referenceId: purchaseOrderId || receipt.id,
        actorId: receivedBy,
      });
    }

    // Update PO received status if attached
    if (purchaseOrderId) {
      await this.updatePOReceivedStatus(tenantId, purchaseOrderId, items);
    }

    receipt.items = receiptItems;
    return receipt;
  }

  private async updatePOReceivedStatus(
    tenantId: string,
    poId: string,
    receivedItems: Array<{ ingredientId: string; quantity: number }>
  ): Promise<void> {
    const po = await this.getPurchaseOrder(tenantId, poId);
    if (!po || !po.items) return;

    let allFullyReceived = true;

    for (const poItem of po.items) {
      const match = receivedItems.find((r) => r.ingredientId === poItem.ingredient_id);
      if (match) {
        poItem.received_quantity += match.quantity;
      }
      if (poItem.received_quantity < poItem.ordered_quantity) {
        allFullyReceived = false;
      }
    }

    const newStatus = allFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
    const now = new Date();

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("purchase_orders", poId, {
        status: newStatus,
        received_at: allFullyReceived ? now : null,
        updated_at: now,
      });
      for (const item of po.items) {
        memoryDb.update("purchase_order_items", item.id, {
          received_quantity: item.received_quantity,
        });
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        "UPDATE purchase_orders SET status = $1, received_at = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4",
        [newStatus, allFullyReceived ? now : null, poId, tenantId]
      );
      for (const item of po.items) {
        await pool.query(
          "UPDATE purchase_order_items SET received_quantity = $1 WHERE id = $2 AND tenant_id = $3",
          [item.received_quantity, item.id, tenantId]
        );
      }
    }
  }

  async getPurchaseOrder(tenantId: string, poId: string): Promise<PurchaseOrder | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const po = memoryDb.findById("purchase_orders", poId);
      if (!po || po.tenant_id !== tenantId) return null;
      const items = memoryDb.find(
        "purchase_order_items",
        (poi: any) => poi.tenant_id === tenantId && poi.purchase_order_id === poId
      );
      return { ...po, items };
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2",
        [poId, tenantId]
      );
      if (res.rows.length === 0) return null;
      const po = res.rows[0];

      const itemsRes = await pool.query(
        "SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 AND tenant_id = $2",
        [poId, tenantId]
      );
      po.items = itemsRes.rows;
      return po;
    }
  }

  async listPurchaseOrders(tenantId: string, branchId?: string): Promise<PurchaseOrder[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const list = memoryDb.find(
        "purchase_orders",
        (p: any) => p.tenant_id === tenantId && (!branchId || p.branch_id === branchId)
      );
      return list.map((p: any) => ({
        ...p,
        items: memoryDb.find(
          "purchase_order_items",
          (poi: any) => poi.tenant_id === tenantId && poi.purchase_order_id === p.id
        ),
      }));
    } else {
      const pool = getPostgresPool();
      const query = branchId
        ? "SELECT * FROM purchase_orders WHERE tenant_id = $1 AND branch_id = $2 ORDER BY created_at DESC"
        : "SELECT * FROM purchase_orders WHERE tenant_id = $1 ORDER BY created_at DESC";
      const params = branchId ? [tenantId, branchId] : [tenantId];
      const res = await pool.query(query, params);
      return res.rows;
    }
  }
}

export const supplierService = new SupplierService();
