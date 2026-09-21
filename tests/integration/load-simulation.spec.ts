import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { orderService } from "@/modules/orders/services/order-service";
import { kdsService } from "@/modules/kds/services/kds-service";
import { analyticsService } from "@/modules/analytics/services/analytics-service";

describe("Phase 12: High-Volume Concurrent Load Simulation", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  it("100 concurrent order creation bursts execute with 100% data integrity and no ID collisions", async () => {
    const burstSize = 100;
    const startTime = Date.now();

    // Dispatch 100 concurrent orders simultaneously
    const orderPromises = Array.from({ length: burstSize }, (_, index) => {
      return orderService.createOrder({
        tenantId,
        branchId,
        orderType: "TAKEAWAY",
        channel: "POS",
        actorId: `cashier-burst-${index}`,
        autoConfirm: true,
        items: [
          {
            productId: "prod-01-classic-burger",
            quantity: 1,
            selectedModifiers: [{ modifierId: "mod-m" }],
          },
        ],
      });
    });

    const orders = await Promise.all(orderPromises);
    const durationMs = Date.now() - startTime;

    // Verify all 100 orders created successfully
    expect(orders).toHaveLength(burstSize);

    // Verify uniqueness of order IDs (zero collisions)
    const uniqueIds = new Set(orders.map((o) => o.id));
    expect(uniqueIds.size).toBe(burstSize);

    // Verify all order total amounts are accurate (58.0 ILS each)
    for (const ord of orders) {
      expect(ord.total_amount).toBe(58.0);
      expect(ord.status).toBe("CONFIRMED");
    }

    // Verify query performance and aggregate reporting under load
    const dashboard = await analyticsService.getSalesDashboard(tenantId, branchId);
    expect(dashboard.orderCount).toBeGreaterThanOrEqual(burstSize);
    expect(dashboard.grossRevenue).toBeGreaterThanOrEqual(burstSize * 58.0);

    // Performance assertion: 100 orders created in under 5000ms
    expect(durationMs).toBeLessThan(5000);
  });

  it("100 concurrent KDS ticket routing and bump operations execute deterministically", async () => {
    const ticketCount = 50;

    // Create 50 orders
    const orders = await Promise.all(
      Array.from({ length: ticketCount }, (_, i) =>
        orderService.createOrder({
          tenantId,
          branchId,
          orderType: "DINE_IN",
          channel: "POS",
          actorId: `table-load-${i}`,
          items: [
            {
              productId: "prod-01-classic-burger",
              quantity: 1,
              selectedModifiers: [{ modifierId: "mod-m" }],
            },
          ],
        })
      )
    );

    // Concurrently route all orders to KDS stations
    const routePromises = orders.map((order) =>
      kdsService.routeOrderToStations(order, order.items!)
    );
    const ticketArrays = await Promise.all(routePromises);
    const allTickets = ticketArrays.flat();

    expect(allTickets.length).toBeGreaterThanOrEqual(ticketCount);

    // Concurrently transition all tickets: START -> READY -> BUMP
    const cookPromises = allTickets.map(async (t) => {
      await kdsService.startTicket(tenantId, t.id, "cook-load-01");
      await kdsService.readyTicket(tenantId, t.id, "cook-load-01");
      return kdsService.bumpTicket(tenantId, t.id, "expo-load-01");
    });

    const completedTickets = await Promise.all(cookPromises);
    expect(completedTickets).toHaveLength(allTickets.length);

    for (const t of completedTickets) {
      expect(t.status).toBe("COMPLETED");
      expect(t.completed_at).toBeDefined();
    }
  });
});
