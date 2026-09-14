/**
 * Inventory Order Event Subscriber
 * Phase 5 - Automatic BOM Stock Depletion & Rollback according to configured Depletion Policies
 */

import { eventBus, DomainEvent } from "../../../core/events/event-bus";
import { inventoryService } from "../services/inventory-service";

let isSubscribed = false;

export function registerInventorySubscribers() {
  if (isSubscribed) return;
  isSubscribed = true;

  // 1. Order Confirmed (Default / ON_ACCEPTED)
  eventBus.subscribe("OrderConfirmed", async (event: DomainEvent) => {
    try {
      const order = event.payload?.order;
      const orderId = order?.id || event.payload?.orderId;
      const branchId = event.branchId || order?.branch_id || order?.branchId;
      if (!orderId || !branchId) return;

      await inventoryService.depleteStockForOrder({
        tenantId: event.tenantId,
        branchId,
        orderId,
        trigger: "ON_ACCEPTED",
        actorId: event.actor?.actorId,
      });
    } catch (err) {
      console.error("[InventorySubscriber] Error depleting stock on OrderConfirmed:", err);
    }
  });

  // 2. Ticket / Preparation Started (ON_PREPARATION_START)
  eventBus.subscribe("KdsTicketStarted", async (event: DomainEvent) => {
    try {
      const ticket = event.payload?.ticket;
      const orderId = ticket?.order_id || event.payload?.orderId;
      const branchId = event.branchId || ticket?.branch_id;
      if (!orderId || !branchId) return;

      await inventoryService.depleteStockForOrder({
        tenantId: event.tenantId,
        branchId,
        orderId,
        trigger: "ON_PREPARATION_START",
        actorId: event.actor?.actorId,
      });
    } catch (err) {
      console.error("[InventorySubscriber] Error depleting stock on KdsTicketStarted:", err);
    }
  });

  // 3. Order Completed (ON_FULFILLMENT)
  eventBus.subscribe("OrderCompleted", async (event: DomainEvent) => {
    try {
      const order = event.payload?.order;
      const orderId = order?.id || event.payload?.orderId;
      const branchId = event.branchId || order?.branch_id || order?.branchId;
      if (!orderId || !branchId) return;

      await inventoryService.depleteStockForOrder({
        tenantId: event.tenantId,
        branchId,
        orderId,
        trigger: "ON_FULFILLMENT",
        actorId: event.actor?.actorId,
      });
    } catch (err) {
      console.error("[InventorySubscriber] Error depleting stock on OrderCompleted:", err);
    }
  });

  // 4. Order Cancelled (Automatic Rollback)
  eventBus.subscribe("OrderCancelled", async (event: DomainEvent) => {
    try {
      const order = event.payload?.order;
      const orderId = order?.id || event.payload?.orderId;
      const branchId = event.branchId || order?.branch_id || order?.branchId || "";
      if (!orderId) return;

      await inventoryService.rollbackStockForOrder({
        tenantId: event.tenantId,
        branchId,
        orderId,
        reason: event.payload?.cancellationReason || "Order cancellation rollback",
        actorId: event.actor?.actorId,
      });
    } catch (err) {
      console.error("[InventorySubscriber] Error rolling back stock on OrderCancelled:", err);
    }
  });
}

// Auto-register on import
registerInventorySubscribers();
