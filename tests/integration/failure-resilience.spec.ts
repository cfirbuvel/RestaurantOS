import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { IntegrationPipelineRunner } from "@/modules/integrations/core/integration-pipeline";
import { MockWoltAdapter } from "@/modules/integrations/aggregators/wolt-adapter";
import { authService } from "@/modules/identity/services/auth-service";
import { orderService } from "@/modules/orders/services/order-service";
import { kdsService } from "@/modules/kds/services/kds-service";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { fleetService } from "@/modules/fleet/services/fleet-service";
import { CouponService } from "@/modules/marketing/services/coupon-service";

describe("Phase 12: Failure, Resilience & State Machine Invariants", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const couponService = new CouponService();

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  // ── 1. Webhook Idempotency & Malformed Payload Handling ─────────────────────

  describe("Webhook Idempotency & Error Boundaries", () => {
    it("Duplicate webhook payload is safely de-duplicated; exactly one order created", async () => {
      const runner = IntegrationPipelineRunner.getInstance();
      const secret = "test-wolt-secret";
      const adapter = new MockWoltAdapter("test-key", secret);

      const rawPayload = JSON.stringify({
        order: {
          id: "wolt-dup-ord-999",
          venue_id: branchId,
          customer: {
            name: "Duplicate Tester",
            phone_number: "+972501112233",
            email: "test@example.com",
          },
          delivery: {
            type: "homedelivery",
            location: {
              street_address: "Ibn Gabirol 50",
              city: "Tel Aviv",
            },
          },
          items: [
            {
              id: "dish-1",
              name: "המבורגר קלאסי 220 גרם",
              count: 1,
              base_price: 5800,
              total_price: 5800,
              options: [{ name: "M", price: 0 }],
            },
          ],
          price: { amount: 7300, currency: "ILS" },
          delivery_fee: { amount: 1500 },
          tip: { amount: 0 },
        },
      });

      const signature = adapter.signPayload(rawPayload, secret);
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // First webhook arrival: succeeds and processes order
      const firstRes = await runner.processInboundOrder({
        provider: "WOLT",
        rawBody: rawPayload,
        headers: {
          "x-wolt-signature": signature,
          "x-wolt-timestamp": timestamp,
        },
        secret,
        tenantId,
        branchId,
        transform: (payload) => adapter.transformToCanonicalOrder(payload),
      });

      expect(firstRes.success).toBe(true);
      expect(firstRes.duplicate).toBeFalsy();
      expect(firstRes.orderId).toBeDefined();

      // Second webhook arrival (duplicate delivery): idempotent acknowledgement
      const secondRes = await runner.processInboundOrder({
        provider: "WOLT",
        rawBody: rawPayload,
        headers: {
          "x-wolt-signature": signature,
          "x-wolt-timestamp": timestamp,
        },
        secret,
        tenantId,
        branchId,
        transform: (payload) => adapter.transformToCanonicalOrder(payload),
      });

      expect(secondRes.success).toBe(true);
      expect(secondRes.duplicate).toBe(true);
      expect(secondRes.orderId).toBe(firstRes.orderId);

      // Verify DB constraint: exactly one order exists for this external ID
      const orders = memoryDb.find(
        "orders",
        (o: any) => o.tenant_id === tenantId && o.external_order_id === "wolt-dup-ord-999"
      );
      expect(orders).toHaveLength(1);
    });

    it("Malformed JSON payload is rejected with 400 Bad Request", async () => {
      const runner = IntegrationPipelineRunner.getInstance();
      const adapter = new MockWoltAdapter("test-key", "secret");

      const res = await runner.processInboundOrder({
        provider: "WOLT",
        rawBody: "{ invalid-json-not-parsable",
        headers: {
          "x-wolt-signature": "dummy",
          "x-wolt-timestamp": "12345",
        },
        secret: "secret",
        tenantId,
        branchId,
        bypassSignature: true,
        transform: (p) => adapter.transformToCanonicalOrder(p),
      });

      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.reason).toContain("Malformed JSON payload");
    });
  });

  // ── 2. Stale Session & Token Security ──────────────────────────────────────

  describe("Session Security & Stale Token Invalidation", () => {
    it("Expired session is rejected and automatically revoked", async () => {
      const user = await authService.registerUser({
        email: "stale-session@restaurantos.test",
        password: "ValidPassword123!",
        firstName: "Test",
        lastName: "Session",
      });

      // Insert an expired session
      const expiredToken = "sess_token_expired_12345";
      memoryDb.insert("sessions", {
        id: "sess-expired-01",
        user_id: user.user.id,
        token: expiredToken,
        expires_at: new Date(Date.now() - 3600000), // expired 1 hour ago
        created_at: new Date(Date.now() - 7200000),
      });

      const session = await authService.validateSession(expiredToken);
      expect(session).toBeNull();

      // Ensure session record was revoked/cleaned from DB
      const dbSession = memoryDb.find("sessions", (s: any) => s.token === expiredToken);
      expect(dbSession).toHaveLength(0);
    });

    it("Forged or unknown session token is rejected with null", async () => {
      const session = await authService.validateSession("forged-non-existent-token");
      expect(session).toBeNull();
    });
  });

  // ── 3. State Machine Invariants & Illegal Transition Prevention ─────────────

  describe("Domain State Machine Invariants", () => {
    it("KDS ticket lifecycle cannot transition directly to COMPLETED without START", async () => {
      const ticket = memoryDb.insert("kds_tickets", {
        id: "ticket-trans-01",
        tenant_id: tenantId,
        order_id: "order-t-01",
        order_number: "ORD-101",
        station_id: "st-01-burgers",
        station_name: "Burgers",
        channel: "TAKEAWAY",
        status: "QUEUED",
        items: [],
        version: 1,
      });

      // Direct bump from QUEUED should fail (must be READY)
      await expect(
        kdsService.bumpTicket(tenantId, ticket.id, "expo-01")
      ).rejects.toThrow();

      // Lifecycle progression: start -> ready -> bump
      await kdsService.startTicket(tenantId, ticket.id, "cook-01");
      await kdsService.readyTicket(tenantId, ticket.id, "cook-01");
      const completed = await kdsService.bumpTicket(tenantId, ticket.id, "expo-01");
      expect(completed.status).toBe("COMPLETED");

      // Attempting to bump an already completed ticket fails
      await expect(
        kdsService.bumpTicket(tenantId, ticket.id, "expo-01")
      ).rejects.toThrow();
    });

    it("Delivery lifecycle rejects premature completion prior to pickup", async () => {
      const order = await orderService.createOrder({
        tenantId,
        branchId,
        channel: "WEB",
        orderType: "DELIVERY",
        actorId: "actor-fail-test",
        items: [
          {
            productId: "prod-01-classic-burger",
            quantity: 1,
            selectedModifiers: [{ modifierId: "mod-m" }],
          },
        ],
      });

      const delivery = await deliveryService.createDelivery({
        tenantId,
        branchId,
        orderId: order.id,
        deliveryAddress: {
          street: "Herzl",
          houseNumber: "1",
          city: "Tel Aviv",
          latitude: 32.06,
          longitude: 34.77,
        },
      });

      // Delivery is currently PENDING / AVAILABLE_FOR_ASSIGNMENT
      // Calling completeDelivery before pickup must be rejected
      await expect(
        deliveryService.completeDelivery(tenantId, delivery.id, "driver-illegal-usr")
      ).rejects.toThrow(/Cannot complete delivery in status/);
    });
  });

  // ── 4. GPS Entry Boundary Invariant (PHASE 00 Section 46 & Section 8) ──────

  describe("GPS Geofence Boundary Invariant", () => {
    it("Entering destination geofence emits ARRIVED_AT_CUSTOMER_AREA but NEVER auto-marks DELIVERED", async () => {
      const destLat = 32.0853;
      const destLon = 34.7818;

      // 1. Create and dispatch a delivery
      const order = await orderService.createOrder({
        tenantId,
        branchId,
        channel: "WEB",
        orderType: "DELIVERY",
        actorId: "actor-fail-test",
        items: [
          {
            productId: "prod-01-classic-burger",
            quantity: 1,
            selectedModifiers: [{ modifierId: "mod-m" }],
          },
        ],
      });

      const vehicle = memoryDb.insert("vehicles", {
        id: "veh-gps-01",
        tenant_id: tenantId,
        license_plate: "12-345-67",
        model: "Electric Scooter",
        status: "ACTIVE",
      });

      await fleetService.assignTrackerToVehicle(tenantId, vehicle.id, "track-01");

      const delivery = await deliveryService.createDelivery({
        tenantId,
        branchId,
        orderId: order.id,
        deliveryAddress: {
          street: "Dizengoff",
          houseNumber: "50",
          city: "Tel Aviv",
          latitude: destLat,
          longitude: destLon,
        },
      });

      // Assign vehicle and dispatch
      memoryDb.update("deliveries", delivery.id, {
        vehicle_id: vehicle.id,
        driver_id: "driver-gps-usr",
        status: "OUT_FOR_DELIVERY",
      });

      // 2. Driver sends telemetry far outside geofence (approx 1km away)
      const telemetryFar = await fleetService.ingestTelemetry(tenantId, {
        trackerId: "track-01",
        latitude: destLat + 0.05,
        longitude: destLon + 0.05,
        speedKmh: 35,
        headingDegrees: 0,
        recordedAt: new Date().toISOString(),
      });
      expect(telemetryFar.geofenceTriggered).toBe(false);

      let currentDelivery = await deliveryService.getDeliveryById(tenantId, delivery.id);
      expect(currentDelivery?.status).toBe("OUT_FOR_DELIVERY");

      // 3. Driver enters proximity geofence (within 50 meters of destination)
      const telemetryNear = await fleetService.ingestTelemetry(tenantId, {
        trackerId: "track-01",
        latitude: destLat + 0.0001,
        longitude: destLon + 0.0001,
        speedKmh: 5,
        headingDegrees: 0,
        recordedAt: new Date().toISOString(),
      });

      expect(telemetryNear.geofenceTriggered).toBe(true);

      // 4. CRITICAL INVARIANT VERIFICATION:
      // Status MUST advance to ARRIVED_AT_CUSTOMER_AREA
      // Status MUST NEVER automatically advance to DELIVERED
      currentDelivery = await deliveryService.getDeliveryById(tenantId, delivery.id);
      expect(currentDelivery?.status).toBe("ARRIVED_AT_CUSTOMER_AREA");
      expect(currentDelivery?.status).not.toBe("DELIVERED");

      // 5. Only explicit driver action completes the delivery
      const completedDelivery = await deliveryService.completeDelivery(
        tenantId,
        delivery.id,
        "driver-gps-usr",
        { signature: "cust_sig_data" }
      );
      expect(completedDelivery.status).toBe("DELIVERED");
    });
  });

  // ── 5. Marketing Limits & Coupon Exhaustion ─────────────────────────────────

  describe("Marketing & Coupon Boundaries", () => {
    it("Enforces strict coupon usage limits; second redemption attempt is rejected", async () => {
      const coupon = couponService.createCoupon(tenantId, {
        code: "SINGLEUSE50",
        discountType: "FIXED_AMOUNT",
        discountValue: 50,
        scope: "ONE_TIME",
        usageLimitGlobal: 1, // Single redemption allowed globally
      });

      // First customer redemptions succeeds
      const firstRedeem = couponService.redeemCoupon(
        tenantId,
        "SINGLEUSE50",
        "cust-01",
        "ord-01",
        100,
        branchId,
        "ONLINE"
      );
      expect(firstRedeem.id).toBeDefined();

      // Second redemption must be rejected due to exhausted limit
      expect(() =>
        couponService.redeemCoupon(
          tenantId,
          "SINGLEUSE50",
          "cust-02",
          "ord-02",
          100,
          branchId,
          "ONLINE"
        )
      ).toThrow();
    });
  });
});
