import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { kdsService } from "@/modules/kds/services/kds-service";
import {
  canTransitionKDSTicket,
  computeKDSSLA,
  VALID_KDS_TRANSITIONS,
} from "@/modules/kds/domain/kds";
import { Order, OrderItem } from "@/modules/orders/domain/order";

describe("Kitchen Display System (KDS) Module", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const cookId = "cook-01";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  describe("Station Management & Seed Configuration", () => {
    it("should initialize default stations for seeded branch", async () => {
      const stations = await kdsService.getStationsForBranch(tenantId, branchId);
      expect(stations.length).toBeGreaterThanOrEqual(3);

      const names = stations.map((s) => s.name);
      expect(names).toContain("burgers");
      expect(names).toContain("sides");
      expect(names).toContain("drinks");
    });

    it("should allow creating a custom KDS station", async () => {
      const station = await kdsService.createStation(tenantId, branchId, {
        name: "salads",
        displayName: "עמדת סלטים (Salads)",
        stationType: "KITCHEN",
      });

      expect(station.id).toBeDefined();
      expect(station.name).toBe("salads");
      expect(station.station_type).toBe("KITCHEN");

      const fetched = await kdsService.getStationById(tenantId, station.id);
      expect(fetched?.name).toBe("salads");
    });
  });

  describe("Order Routing to Stations (Multi-Station Architecture)", () => {
    it("should route items to separate station tickets according to product assignments", async () => {
      const sampleOrder: Order = {
        id: "ord-test-route-1",
        tenant_id: tenantId,
        branch_id: branchId,
        customer_id: "cust-01-israel-israeli",
        order_number: "ORD-9901",
        channel: "WEB",
        order_type: "DELIVERY",
        status: "CONFIRMED",
        payment_status: "PAID",
        subtotal: 92.0,
        tax_amount: 15.64,
        discount_amount: 0,
        delivery_fee: 15,
        tip_amount: 10,
        total_amount: 117,
        currency: "ILS",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const items: OrderItem[] = [
        {
          id: "oi-bgr",
          order_id: sampleOrder.id,
          product_id: "prod-01-classic-burger",
          name: "המבורגר קלאסי 220 גרם",
          quantity: 2,
          unit_price: 58,
          total_price: 116,
          notes: "ללא בצל",
          selected_modifiers: [{ modifier_id: "mod-cheddar", name: "צ'דר", price: 8 }],
        },
        {
          id: "oi-frs",
          order_id: sampleOrder.id,
          product_id: "prod-02-fries",
          name: "צ'יפס בלגי",
          quantity: 1,
          unit_price: 22,
          total_price: 22,
          selected_modifiers: [],
        },
      ];

      const tickets = await kdsService.routeOrderToStations(sampleOrder, items);

      expect(tickets.length).toBe(2);
      const burgerTicket = tickets.find((t) => t.station_id === "st-01-burgers");
      const friesTicket = tickets.find((t) => t.station_id === "st-02-sides");

      expect(burgerTicket).toBeDefined();
      expect(burgerTicket?.status).toBe("QUEUED");
      expect(burgerTicket?.items?.length).toBe(1);
      expect(burgerTicket?.items?.[0].name).toBe("המבורגר קלאסי 220 גרם");

      expect(friesTicket).toBeDefined();
      expect(friesTicket?.status).toBe("QUEUED");
      expect(friesTicket?.items?.length).toBe(1);
      expect(friesTicket?.items?.[0].name).toBe("צ'יפס בלגי");
    });

    it("should guarantee ZERO Customer PII on KDS tickets", async () => {
      const tickets = await kdsService.getTicketsForStation(tenantId, branchId);
      expect(tickets.length).toBeGreaterThan(0);

      for (const t of tickets) {
        // Must NOT have customer name, phone, email, address, or payment details
        expect((t as any).customer_name).toBeUndefined();
        expect((t as any).phone).toBeUndefined();
        expect((t as any).email).toBeUndefined();
        expect((t as any).address).toBeUndefined();
        expect((t as any).total_amount).toBeUndefined();

        // Must have kitchen-relevant fields
        expect(t.order_number).toBeDefined();
        expect(t.status).toBeDefined();
        expect(t.priority).toBeDefined();
        expect(t.items).toBeDefined();
      }
    });
  });

  describe("KDS Ticket Preparation Lifecycle (State Machine)", () => {
    it("should correctly transition QUEUED -> STARTED -> READY -> COMPLETED", async () => {
      const seededTicketId = "kds-tkt-01-burgers";

      // 1. QUEUED -> STARTED
      const started = await kdsService.startTicket(tenantId, seededTicketId, cookId);
      expect(started.status).toBe("STARTED");
      expect(started.started_at).toBeDefined();
      expect(started.cook_id).toBe(cookId);

      // 2. STARTED -> READY
      const { ticket: readyTicket } = await kdsService.readyTicket(tenantId, seededTicketId, cookId);
      expect(readyTicket.status).toBe("READY");
      expect(readyTicket.ready_at).toBeDefined();

      // 3. READY -> COMPLETED (bumped)
      const bumped = await kdsService.bumpTicket(tenantId, seededTicketId, cookId);
      expect(bumped.status).toBe("COMPLETED");
      expect(bumped.completed_at).toBeDefined();
    });

    it("should support recalling a bumped ticket: COMPLETED -> RECALLED -> READY", async () => {
      const seededTicketId = "kds-tkt-01-burgers";

      await kdsService.startTicket(tenantId, seededTicketId, cookId);
      await kdsService.readyTicket(tenantId, seededTicketId, cookId);
      await kdsService.bumpTicket(tenantId, seededTicketId, cookId);

      // Recall bumped ticket
      const recalled = await kdsService.recallTicket(tenantId, seededTicketId, "manager-01");
      expect(recalled.status).toBe("RECALLED");
      expect(recalled.recalled_at).toBeDefined();

      // Can transition back to READY or STARTED
      expect(canTransitionKDSTicket("RECALLED", "READY")).toBe(true);
      expect(canTransitionKDSTicket("RECALLED", "STARTED")).toBe(true);
    });

    it("should reject invalid state transitions", async () => {
      const seededTicketId = "kds-tkt-01-burgers";

      // Cannot bump QUEUED ticket directly to COMPLETED
      await expect(kdsService.bumpTicket(tenantId, seededTicketId, cookId)).rejects.toThrow(
        "Cannot bump ticket in status QUEUED"
      );

      // Cannot mark QUEUED ticket as READY directly
      await expect(kdsService.readyTicket(tenantId, seededTicketId, cookId)).rejects.toThrow(
        "Cannot mark ready for ticket in status QUEUED"
      );
    });

    it("should validate all transitions via canTransitionKDSTicket helper", () => {
      expect(canTransitionKDSTicket("QUEUED", "STARTED")).toBe(true);
      expect(canTransitionKDSTicket("STARTED", "READY")).toBe(true);
      expect(canTransitionKDSTicket("READY", "COMPLETED")).toBe(true);
      expect(canTransitionKDSTicket("COMPLETED", "RECALLED")).toBe(true);

      // Disallowed
      expect(canTransitionKDSTicket("QUEUED", "COMPLETED")).toBe(false);
      expect(canTransitionKDSTicket("QUEUED", "READY")).toBe(false);
      expect(canTransitionKDSTicket("STARTED", "COMPLETED")).toBe(false);
    });
  });

  describe("Cross-Station Coordination & OrderReady Trigger", () => {
    it("should automatically update order status to READY when ALL stations are READY", async () => {
      const orderId = "ord-01-seed-sample";
      const initialOrder = memoryDb.findById("orders", orderId);
      expect(initialOrder.status).not.toBe("READY");

      // Mark ticket 1 ready
      await kdsService.startTicket(tenantId, "kds-tkt-01-burgers", cookId);
      const res1 = await kdsService.readyTicket(tenantId, "kds-tkt-01-burgers", cookId);
      expect(res1.allStationsReady).toBe(false);

      // Mark ticket 2 ready
      await kdsService.startTicket(tenantId, "kds-tkt-02-sides", cookId);
      const res2 = await kdsService.readyTicket(tenantId, "kds-tkt-02-sides", cookId);
      expect(res2.allStationsReady).toBe(false);

      // Mark ticket 3 ready (last station)
      await kdsService.startTicket(tenantId, "kds-tkt-03-drinks", cookId);
      const res3 = await kdsService.readyTicket(tenantId, "kds-tkt-03-drinks", cookId);
      expect(res3.allStationsReady).toBe(true);

      // Downstream Order status should now be updated to READY
      const updatedOrder = memoryDb.findById("orders", orderId);
      expect(updatedOrder.status).toBe("READY");
    });
  });

  describe("KDS SLA Visualization Model (PHASE 00 Section 27)", () => {
    it("should return NORMAL when ticket is well within target prep SLA", () => {
      const queuedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 mins elapsed
      const sla = computeKDSSLA(queuedAt, 15); // target 15 mins

      expect(sla.slaStatus).toBe("NORMAL");
      expect(sla.isExceeded).toBe(false);
      expect(sla.remainingSeconds).toBeGreaterThan(0);
    });

    it("should return NEAR_SLA when ticket is approaching SLA limit (>= 75%)", () => {
      const queuedAt = new Date(Date.now() - 12 * 60 * 1000); // 12 mins elapsed (80% of 15)
      const sla = computeKDSSLA(queuedAt, 15);

      expect(sla.slaStatus).toBe("NEAR_SLA");
      expect(sla.isExceeded).toBe(false);
    });

    it("should return SLA_EXCEEDED with formatted overtime e.g. '+00:37'", () => {
      const queuedAt = new Date(Date.now() - (15 * 60 + 37) * 1000); // 15 mins + 37s
      const sla = computeKDSSLA(queuedAt, 15);

      expect(sla.slaStatus).toBe("SLA_EXCEEDED");
      expect(sla.isExceeded).toBe(true);
      expect(sla.formattedTimer).toBe("+00:37");
    });
  });

  describe("Tenant Isolation", () => {
    it("should strictly prevent cross-tenant access to KDS tickets", async () => {
      const otherTenantId = "22222222-2222-2222-2222-222222222222";
      const otherBranchId = "branch-other";

      const tickets = await kdsService.getTicketsForStation(otherTenantId, otherBranchId);
      expect(tickets).toHaveLength(0);

      // Attempting to modify tenant A's ticket from tenant B must fail
      await expect(
        kdsService.startTicket(otherTenantId, "kds-tkt-01-burgers", cookId)
      ).rejects.toThrow("KDS ticket not found");
    });
  });
});
