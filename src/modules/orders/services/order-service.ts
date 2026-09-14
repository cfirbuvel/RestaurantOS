import crypto from "crypto";
import { memoryDb, getPostgresPool } from "@/core/database/db";
import { eventBus } from "@/core/events/event-bus";
import { menuService } from "@/modules/menu/services/menu-service";
import { customerService } from "@/modules/crm/services/customer-service";
import { kdsService } from "@/modules/kds/services/kds-service";
import {
  Order,
  OrderItem,
  OrderStatus,
  OrderChannel,
  OrderType,
  canTransitionOrder,
} from "../domain/order";

export interface CreateOrderParams {
  tenantId: string;
  branchId: string;
  customerId?: string | null;
  channel: OrderChannel;
  orderType: OrderType;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    notes?: string;
    selectedModifiers?: Array<{ modifierId: string }>;
  }>;
  deliveryAddressId?: string | null;
  notes?: string;
  kitchenNotes?: string;
  discountAmount?: number;
  deliveryFee?: number;
  tipAmount?: number;
  externalOrderId?: string;
  metadata?: Record<string, any>;
  autoConfirm?: boolean;
  actorId: string;
  actorType?: "USER" | "SYSTEM" | "INTEGRATION";
}

export class OrderService {
  /**
   * Create a new Universal Order
   */
  async createOrder(params: CreateOrderParams): Promise<Order> {
    const {
      tenantId,
      branchId,
      customerId,
      channel,
      orderType,
      items: inputItems,
      deliveryAddressId,
      notes,
      kitchenNotes,
      discountAmount = 0,
      deliveryFee = 0,
      tipAmount = 0,
      externalOrderId,
      metadata = {},
      autoConfirm = false,
      actorId,
      actorType = "USER",
    } = params;

    // Validate and calculate every line item
    let subtotal = 0;
    let taxAmount = 0;
    const computedItems: Array<Omit<OrderItem, "id" | "order_id">> = [];

    for (const item of inputItems) {
      const calc = await menuService.validateAndCalculateOrderItem(tenantId, branchId, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        selectedModifiers: item.selectedModifiers,
      });

      subtotal += calc.totalPrice;
      // Default standard Israeli VAT 17% included in price calculation
      const itemTax = Number((calc.totalPrice * 0.17).toFixed(2));
      taxAmount += itemTax;

      computedItems.push({
        product_id: item.productId,
        variant_id: item.variantId || null,
        name: calc.name,
        quantity: item.quantity,
        unit_price: calc.unitPrice,
        total_price: calc.totalPrice,
        notes: item.notes || null,
        selected_modifiers: calc.modifiersDetail,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    taxAmount = Number(taxAmount.toFixed(2));
    const totalAmount = Number(
      Math.max(0, subtotal - discountAmount + deliveryFee + tipAmount).toFixed(2)
    );

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const initialStatus: OrderStatus = autoConfirm ? "CONFIRMED" : "DRAFT";

    const orderRecord: Partial<Order> = {
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: customerId || null,
      order_number: orderNumber,
      channel,
      order_type: orderType,
      status: initialStatus,
      payment_status: autoConfirm ? "PAID" : "PENDING",
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      delivery_fee: deliveryFee,
      tip_amount: tipAmount,
      total_amount: totalAmount,
      currency: "ILS",
      notes: notes || null,
      kitchen_notes: kitchenNotes || null,
      delivery_address_id: deliveryAddressId || null,
      external_order_id: externalOrderId || null,
      metadata,
      created_by: actorId,
    };

    let savedOrder: Order;
    const savedItems: OrderItem[] = [];

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      savedOrder = memoryDb.insert("orders", orderRecord) as Order;
      for (const ci of computedItems) {
        const itemRecord = memoryDb.insert("order_items", {
          ...ci,
          order_id: savedOrder.id,
        });
        savedItems.push(itemRecord as OrderItem);
      }
      savedOrder.items = savedItems;
    } else {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const oRes = await client.query(
          `INSERT INTO orders (
            tenant_id, branch_id, customer_id, order_number, channel, order_type,
            status, payment_status, subtotal, tax_amount, discount_amount, delivery_fee,
            tip_amount, total_amount, currency, notes, kitchen_notes, delivery_address_id,
            external_order_id, metadata, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          RETURNING *`,
          [
            tenantId,
            branchId,
            orderRecord.customer_id,
            orderRecord.order_number,
            orderRecord.channel,
            orderRecord.order_type,
            orderRecord.status,
            orderRecord.payment_status,
            orderRecord.subtotal,
            orderRecord.tax_amount,
            orderRecord.discount_amount,
            orderRecord.delivery_fee,
            orderRecord.tip_amount,
            orderRecord.total_amount,
            orderRecord.currency,
            orderRecord.notes,
            orderRecord.kitchen_notes,
            orderRecord.delivery_address_id,
            orderRecord.external_order_id,
            JSON.stringify(orderRecord.metadata),
            orderRecord.created_by,
          ]
        );
        savedOrder = oRes.rows[0] as Order;

        for (const ci of computedItems) {
          const oiRes = await client.query(
            `INSERT INTO order_items (
              order_id, product_id, variant_id, name, quantity, unit_price, total_price, notes, selected_modifiers
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
              savedOrder.id,
              ci.product_id,
              ci.variant_id,
              ci.name,
              ci.quantity,
              ci.unit_price,
              ci.total_price,
              ci.notes,
              JSON.stringify(ci.selected_modifiers),
            ]
          );
          savedItems.push(oiRes.rows[0] as OrderItem);
        }
        await client.query("COMMIT");
        savedOrder.items = savedItems;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    // Publish OrderCreated event to transactional outbox
    await eventBus.publish({
      eventType: "OrderCreated",
      tenantId,
      branchId,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType },
      payload: {
        orderId: savedOrder.id,
        orderNumber: savedOrder.order_number,
        channel: savedOrder.channel,
        orderType: savedOrder.order_type,
        totalAmount: savedOrder.total_amount,
        itemsCount: savedItems.length,
      },
    });

    if (autoConfirm) {
      await eventBus.publish({
        eventType: "OrderConfirmed",
        tenantId,
        branchId,
        correlationId: crypto.randomUUID(),
        actor: { actorId, actorType },
        payload: {
          orderId: savedOrder.id,
          orderNumber: savedOrder.order_number,
          confirmedAt: new Date().toISOString(),
          paymentStatus: savedOrder.payment_status,
        },
      });

      await kdsService.routeOrderToStations(savedOrder, savedItems);
    }

    return savedOrder;
  }

  // ── Explicit Domain Commands ──────────────────────────────────────────────

  /**
   * Domain Command: Confirm order (DRAFT -> CONFIRMED)
   */
  async confirmOrder(
    tenantId: string,
    orderId: string,
    actorId: string,
    actorType: "USER" | "SYSTEM" = "USER"
  ): Promise<Order> {
    const order = await this.getOrderRaw(tenantId, orderId);
    if (!order) throw new Error("Order not found");

    if (!canTransitionOrder(order.status, "CONFIRMED")) {
      throw new Error(`Cannot confirm order in status ${order.status}`);
    }

    const patch = {
      status: "CONFIRMED" as OrderStatus,
      payment_status: "PAID" as const,
      updated_at: new Date(),
    };

    const updated = await this.updateOrderRaw(tenantId, orderId, patch);

    await eventBus.publish({
      eventType: "OrderConfirmed",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType },
      payload: {
        orderId: updated.id,
        orderNumber: updated.order_number,
        confirmedAt: new Date().toISOString(),
        paymentStatus: updated.payment_status,
      },
    });

    const fullOrder = await this.getOrder(tenantId, orderId);
    if (fullOrder && fullOrder.items) {
      await kdsService.routeOrderToStations(fullOrder, fullOrder.items);
    }

    return updated;
  }

  /**
   * Domain Command: Accept order (CONFIRMED -> ACCEPTED)
   */
  async acceptOrder(
    tenantId: string,
    orderId: string,
    estimatedPrepMinutes: number = 20,
    actorId: string,
    actorType: "USER" | "SYSTEM" = "USER"
  ): Promise<Order> {
    const order = await this.getOrderRaw(tenantId, orderId);
    if (!order) throw new Error("Order not found");

    if (!canTransitionOrder(order.status, "ACCEPTED")) {
      throw new Error(`Cannot accept order in status ${order.status}`);
    }

    const estimatedReadyAt = new Date(Date.now() + estimatedPrepMinutes * 60 * 1000);
    const patch = {
      status: "ACCEPTED" as OrderStatus,
      estimated_ready_at: estimatedReadyAt,
      updated_at: new Date(),
    };

    const updated = await this.updateOrderRaw(tenantId, orderId, patch);

    await eventBus.publish({
      eventType: "OrderAccepted",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType },
      payload: {
        orderId: updated.id,
        orderNumber: updated.order_number,
        estimatedReadyAt: estimatedReadyAt.toISOString(),
        acceptedBy: actorId,
      },
    });

    return updated;
  }

  /**
   * Domain Command: Start Preparation (ACCEPTED -> IN_PREPARATION)
   */
  async startPreparation(
    tenantId: string,
    orderId: string,
    actorId: string,
    actorType: "USER" | "SYSTEM" = "USER"
  ): Promise<Order> {
    const order = await this.getOrderRaw(tenantId, orderId);
    if (!order) throw new Error("Order not found");

    if (!canTransitionOrder(order.status, "IN_PREPARATION")) {
      throw new Error(`Cannot start preparation for order in status ${order.status}`);
    }

    const patch = {
      status: "IN_PREPARATION" as OrderStatus,
      updated_at: new Date(),
    };

    const updated = await this.updateOrderRaw(tenantId, orderId, patch);

    await eventBus.publish({
      eventType: "OrderPreparationStarted",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType },
      payload: {
        orderId: updated.id,
        orderNumber: updated.order_number,
        startedAt: new Date().toISOString(),
      },
    });

    return updated;
  }

  /**
   * Domain Command: Mark Ready (IN_PREPARATION -> READY)
   */
  async readyOrder(
    tenantId: string,
    orderId: string,
    actorId: string,
    actorType: "USER" | "SYSTEM" = "USER"
  ): Promise<Order> {
    const order = await this.getOrderRaw(tenantId, orderId);
    if (!order) throw new Error("Order not found");

    if (!canTransitionOrder(order.status, "READY")) {
      throw new Error(`Cannot mark ready for order in status ${order.status}`);
    }

    const now = new Date();
    const patch = {
      status: "READY" as OrderStatus,
      actual_ready_at: now,
      updated_at: now,
    };

    const updated = await this.updateOrderRaw(tenantId, orderId, patch);

    await eventBus.publish({
      eventType: "OrderReady",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType },
      payload: {
        orderId: updated.id,
        orderNumber: updated.order_number,
        readyAt: now.toISOString(),
        orderType: updated.order_type,
      },
    });

    return updated;
  }

  /**
   * Domain Command: Complete order (READY -> COMPLETED)
   */
  async completeOrder(
    tenantId: string,
    orderId: string,
    actorId: string,
    actorType: "USER" | "SYSTEM" = "USER"
  ): Promise<Order> {
    const order = await this.getOrderRaw(tenantId, orderId);
    if (!order) throw new Error("Order not found");

    if (!canTransitionOrder(order.status, "COMPLETED")) {
      throw new Error(`Cannot complete order in status ${order.status}`);
    }

    const now = new Date();
    const patch = {
      status: "COMPLETED" as OrderStatus,
      completed_at: now,
      updated_at: now,
    };

    const updated = await this.updateOrderRaw(tenantId, orderId, patch);

    // Update customer CRM metrics if applicable
    if (updated.customer_id) {
      await customerService.recordOrderCompleted(
        tenantId,
        updated.customer_id,
        Number(updated.total_amount)
      );
    }

    await eventBus.publish({
      eventType: "OrderCompleted",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType },
      payload: {
        orderId: updated.id,
        orderNumber: updated.order_number,
        completedAt: now.toISOString(),
        totalAmount: updated.total_amount,
      },
    });

    return updated;
  }

  /**
   * Domain Command: Cancel order (from DRAFT, CONFIRMED, ACCEPTED, IN_PREPARATION)
   */
  async cancelOrder(
    tenantId: string,
    orderId: string,
    reason: string,
    actorId: string,
    actorType: "USER" | "SYSTEM" = "USER"
  ): Promise<Order> {
    const order = await this.getOrderRaw(tenantId, orderId);
    if (!order) throw new Error("Order not found");

    if (!canTransitionOrder(order.status, "CANCELLED")) {
      throw new Error(`Cannot cancel order in status ${order.status}`);
    }

    const now = new Date();
    const patch = {
      status: "CANCELLED" as OrderStatus,
      cancelled_at: now,
      cancellation_reason: reason,
      updated_at: now,
    };

    const updated = await this.updateOrderRaw(tenantId, orderId, patch);

    await eventBus.publish({
      eventType: "OrderCancelled",
      tenantId,
      branchId: updated.branch_id,
      correlationId: crypto.randomUUID(),
      actor: { actorId, actorType },
      payload: {
        orderId: updated.id,
        orderNumber: updated.order_number,
        reason,
        cancelledBy: actorId,
        cancelledAt: now.toISOString(),
      },
    });

    return updated;
  }

  // ── Queries with Data Minimization ────────────────────────────────────────

  /**
   * Get order with Role-based Data Minimization.
   * If user is DRIVER, strips sensitive CRM metrics and returns DeliveryViewDTO.
   */
  async getOrder(
    tenantId: string,
    orderId: string,
    userRole?: string
  ): Promise<any> {
    const order = await this.getOrderRaw(tenantId, orderId);
    if (!order) return null;

    if (userRole === "DRIVER") {
      let deliveryView = null;
      if (order.customer_id) {
        deliveryView = await customerService.getDeliveryView(
          tenantId,
          order.customer_id,
          order.delivery_address_id || undefined
        );
      }

      return {
        id: order.id,
        orderNumber: order.order_number,
        orderType: order.order_type,
        status: order.status,
        notes: order.notes,
        deliveryView,
        items: order.items?.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          notes: i.notes,
          selectedModifiers: i.selected_modifiers,
        })),
        readyAt: order.actual_ready_at,
      };
    }

    return order;
  }

  /**
   * List orders with filtering
   */
  async listOrders(
    tenantId: string,
    filters: {
      branchId?: string;
      status?: OrderStatus;
      channel?: OrderChannel;
      orderType?: OrderType;
      customerId?: string;
      limit?: number;
    } = {}
  ): Promise<Order[]> {
    const { branchId, status, channel, orderType, customerId, limit = 50 } = filters;

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const orders = memoryDb.find("orders", (o: any) => {
        if (o.tenant_id !== tenantId || o.deleted_at) return false;
        if (branchId && o.branch_id !== branchId) return false;
        if (status && o.status !== status) return false;
        if (channel && o.channel !== channel) return false;
        if (orderType && o.order_type !== orderType) return false;
        if (customerId && o.customer_id !== customerId) return false;
        return true;
      });

      const hydrated: Order[] = [];
      for (const o of orders.slice(0, limit)) {
        const items = memoryDb.find("order_items", (i: any) => i.order_id === o.id);
        hydrated.push({ ...o, items } as Order);
      }
      return hydrated;
    }

    const pool = getPostgresPool();
    let query = "SELECT * FROM orders WHERE tenant_id = $1 AND deleted_at IS NULL";
    const params: any[] = [tenantId];
    let idx = 2;

    if (branchId) {
      query += ` AND branch_id = $${idx++}`;
      params.push(branchId);
    }
    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (channel) {
      query += ` AND channel = $${idx++}`;
      params.push(channel);
    }
    if (orderType) {
      query += ` AND order_type = $${idx++}`;
      params.push(orderType);
    }
    if (customerId) {
      query += ` AND customer_id = $${idx++}`;
      params.push(customerId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(limit);

    const res = await pool.query(query, params);
    const orders = res.rows as Order[];

    for (const o of orders) {
      const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [o.id]);
      o.items = itemsRes.rows as OrderItem[];
    }

    return orders;
  }

  // ── Internal Helpers ──────────────────────────────────────────────────────

  private async getOrderRaw(tenantId: string, orderId: string): Promise<Order | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const found = memoryDb.find("orders", (o: any) => o.id === orderId && o.tenant_id === tenantId && !o.deleted_at);
      if (found.length === 0) return null;
      const order = { ...found[0] } as Order;
      order.items = memoryDb.find("order_items", (i: any) => i.order_id === orderId) as OrderItem[];
      return order;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [orderId, tenantId]
    );
    if (res.rows.length === 0) return null;
    const order = res.rows[0] as Order;
    const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
    order.items = itemsRes.rows as OrderItem[];
    return order;
  }

  private async updateOrderRaw(tenantId: string, orderId: string, patch: any): Promise<Order> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const updated = memoryDb.update("orders", orderId, patch);
      const items = memoryDb.find("order_items", (i: any) => i.order_id === orderId);
      return { ...updated, items } as Order;
    }

    const pool = getPostgresPool();
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(patch)) {
      setClauses.push(`${k} = $${idx++}`);
      values.push(v);
    }

    values.push(orderId, tenantId);
    const query = `UPDATE orders SET ${setClauses.join(", ")} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`;
    const res = await pool.query(query, values);
    const order = res.rows[0] as Order;
    const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
    order.items = itemsRes.rows as OrderItem[];
    return order;
  }
}

export const orderService = new OrderService();
