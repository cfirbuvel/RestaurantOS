/**
 * RestaurantOS — Phase 11: Security Hardening & Master Regression Suite
 *
 * Comprehensive tests covering:
 *  1. Authentication & Session Invalidation
 *  2. Authorization & RBAC Privilege Escalation Prevention
 *  3. Multi-Tenant Isolation & IDOR Protection (PHASE 00 Section 32)
 *  4. Real-Time WebSocket Handshake & Channel Authorization (PHASE 00 Sections 28 & 29)
 *  5. Driver Data Minimization via DeliveryViewDTO (PHASE 00 Section 31)
 *  6. Fleet Telemetry Privacy & Shift-bound Tracking (PHASE 00 Section 42)
 *  7. Zero Credential Leakage in Audit Trail
 *  8. File Upload, Path Traversal, and Webhook Replay Protection
 */

import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { authService } from "@/modules/identity/services/auth-service";
import { verifyPermission, verifyRole } from "@/modules/identity/middleware/auth-guard";
import { realtimeService } from "@/modules/realtime/services/realtime-service";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { toDeliveryViewDTO as toCrmDeliveryViewDTO } from "@/modules/crm/domain/customer";
import { fleetService } from "@/modules/fleet/services/fleet-service";
import { sanitizeAuditData, AuditLogger } from "@/core/audit/audit-logger";
import { validateFileUpload } from "@/core/security/file-validator";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";

describe("Phase 11: Security Hardening Master Regression Suite", () => {
  const tenantA = "11111111-1111-4000-8000-000000000001";
  const tenantB = "22222222-2222-4000-8000-000000000002";
  const branchA = "aaaaaaaa-aaaa-4000-8000-000000000001";
  const branchB = "bbbbbbbb-bbbb-4000-8000-000000000002";

  beforeEach(() => {
    memoryDb.reset();
  });

  // ── 1. Authentication & Session Lifecycle ───────────────────────────────────

  describe("1. Authentication & Session Lifecycle", () => {
    it("rejects non-existent and empty session tokens", async () => {
      expect(await authService.validateSession("")).toBeNull();
      expect(await authService.validateSession("invalid_random_token_123456")).toBeNull();
    });

    it("passwords are never stored in plaintext and match bcrypt/hash structure", async () => {
      const { user } = await authService.registerUser({
        email: "secops@restaurant.io",
        password: "SuperSecretPassword123!",
        firstName: "Sec",
        lastName: "Ops",
        organizationName: "SecCorp",
      });

      const dbUser = memoryDb.findById("users", user.id);
      expect(dbUser).toBeDefined();
      expect(dbUser.password_hash).toBeDefined();
      expect(dbUser.password_hash).not.toContain("SuperSecretPassword123!");
      // Hash should be salted and hashed (e.g. bcrypt prefix $2a$ or $2b$)
      expect(dbUser.password_hash.startsWith("$2")).toBe(true);
    });

    it("session revocation prevents subsequent authentication", async () => {
      await authService.registerUser({
        email: "logout@restaurant.io",
        password: "Password123!",
        firstName: "Log",
        lastName: "Out",
        organizationName: "Logout Corp",
      });

      const { session } = await authService.loginWithPassword("logout@restaurant.io", "Password123!");
      expect(await authService.validateSession(session.token)).not.toBeNull();

      // Revoke session
      await authService.revokeSession(session.token);
      expect(await authService.validateSession(session.token)).toBeNull();
    });
  });

  // ── 2. Authorization & RBAC Privilege Escalation ───────────────────────────

  describe("2. Authorization & RBAC Privilege Escalation Prevention", () => {
    it("DRIVER and CASHIER roles cannot access management permissions", () => {
      const driverSession: any = {
        userId: "drv-001",
        role: "DRIVER",
        organizationId: tenantA,
      };

      const cashierSession: any = {
        userId: "csh-001",
        role: "CASHIER",
        organizationId: tenantA,
      };

      // Privileged operations must be strictly denied
      expect(verifyPermission(driverSession, "delivery.manage")).toBe(false);
      expect(verifyPermission(driverSession, "promotions.manage")).toBe(false);
      expect(verifyPermission(driverSession, "billing.manage")).toBe(false);
      expect(verifyPermission(cashierSession, "delivery.manage")).toBe(false);
      expect(verifyPermission(cashierSession, "settings.manage")).toBe(false);
    });

    it("MANAGER role has operational dispatch and reporting access but lacks system admin config", () => {
      const managerSession: any = {
        userId: "mgr-001",
        role: "MANAGER",
        organizationId: tenantA,
      };

      expect(verifyPermission(managerSession, "delivery.manage")).toBe(true);
      expect(verifyPermission(managerSession, "reports.read")).toBe(true);
      expect(verifyRole(managerSession, ["ADMIN", "OWNER"])).toBe(false);
    });
  });

  // ── 3. Multi-Tenant Isolation & IDOR Protection ────────────────────────────

  describe("3. Multi-Tenant Isolation & IDOR Protection (PHASE 00 Section 32)", () => {
    it("Tenant B cannot read or mutate Tenant A records", () => {
      memoryDb.insert("orders", {
        id: "ord-tenant-a-101",
        tenant_id: tenantA,
        branch_id: branchA,
        customer_name: "Tenant A Customer",
        total: 150,
      });

      // Tenant B queries with tenant isolation context
      memoryDb.setTenantContext(tenantB);
      const ordersForTenantB = memoryDb.find("orders", (o: any) => o.id === "ord-tenant-a-101");
      const directLookup = memoryDb.findById("orders", "ord-tenant-a-101");
      memoryDb.clearTenantContext();

      expect(ordersForTenantB).toHaveLength(0);
      expect(directLookup).toBeNull();
    });

    it("cross-tenant driver assignment is rejected (composite tenant integrity)", async () => {
      // Driver belongs to Tenant B
      const driverB = memoryDb.insert("delivery_drivers", {
        id: "drv-tenant-b",
        tenant_id: tenantB,
        user_id: "usr-b",
        name: "Tenant B Driver",
        phone: "+972500000002",
        shift_status: "ON_SHIFT",
        assignment_status: "AVAILABLE",
        is_active: true,
      });

      // Delivery belongs to Tenant A
      const deliveryA = memoryDb.insert("deliveries", {
        id: "del-tenant-a",
        tenant_id: tenantA,
        branch_id: branchA,
        order_id: "ord-a-1",
        status: "AVAILABLE_FOR_ASSIGNMENT",
        version: 1,
      });

      // Attempting to assign Tenant B driver to Tenant A delivery must fail
      await expect(
        deliveryService.assignDelivery({
          tenantId: tenantA,
          deliveryId: deliveryA.id,
          driverId: driverB.id,
        })
      ).rejects.toThrow(/does not belong to tenant/i);
    });
  });

  // ── 4. Real-Time WebSocket Handshake & Channel Boundaries ──────────────────

  describe("4. Real-Time Handshake & Channel Security (PHASE 00 Sections 28 & 29)", () => {
    it("issues ephemeral single-use ticket with 60s TTL", async () => {
      const ticketRes = await realtimeService.issueTicket({
        tenantId: tenantA,
        branchId: branchA,
        userId: "usr-kds-1",
        role: "KITCHEN_EMPLOYEE",
        ttlSeconds: 60,
      });

      expect(ticketRes.ticket).toBeDefined();
      expect(ticketRes.ticket.startsWith("tk_")).toBe(true);
      const expiry = new Date(ticketRes.expiresAt).getTime();
      expect(expiry).toBeGreaterThan(Date.now() + 50000);
      expect(expiry).toBeLessThanOrEqual(Date.now() + 61000);
    });

    it("enforces single-use ticket consumption (replay attack prevention)", async () => {
      const ticketRes = await realtimeService.issueTicket({
        tenantId: tenantA,
        branchId: branchA,
        userId: "usr-kds-1",
        role: "KITCHEN_EMPLOYEE",
      });

      // First consumption succeeds
      const consumed = await realtimeService.validateAndConsumeTicket(ticketRes.ticket);
      expect(consumed.ticket).toBe(ticketRes.ticket);

      // Replay attempt fails
      await expect(
        realtimeService.validateAndConsumeTicket(ticketRes.ticket)
      ).rejects.toThrow(/already been consumed|single-use/i);
    });

    it("strictly blocks drivers from subscribing to other drivers, dispatch, or admin channels", () => {
      const driverId = "drv-my-id";
      const otherDriverId = "drv-other-id";

      // Driver can access their own driver channel
      expect(
        realtimeService.canAccessChannel("DRIVER", branchA, `driver:${driverId}`, null, driverId, tenantA)
      ).toBe(true);

      // Driver CANNOT access another driver's channel
      expect(
        realtimeService.canAccessChannel("DRIVER", branchA, `driver:${otherDriverId}`, null, driverId, tenantA)
      ).toBe(false);

      // Driver CANNOT access dispatch, telemetry, or admin
      expect(
        realtimeService.canAccessChannel("DRIVER", branchA, `dispatch:${branchA}`, null, driverId, tenantA)
      ).toBe(false);
      expect(
        realtimeService.canAccessChannel("DRIVER", branchA, `vehicle_telemetry:${branchA}`, null, driverId, tenantA)
      ).toBe(false);
      expect(
        realtimeService.canAccessChannel("DRIVER", branchA, `admin:${tenantA}`, null, driverId, tenantA)
      ).toBe(false);
    });

    it("only fleet/delivery managers and admins can subscribe to vehicle telemetry channels", () => {
      expect(
        realtimeService.canAccessChannel("DELIVERY_MANAGER", branchA, `vehicle_telemetry:${branchA}`)
      ).toBe(true);
      expect(
        realtimeService.canAccessChannel("ADMIN", branchA, `vehicle_telemetry:${branchA}`)
      ).toBe(true);
      expect(
        realtimeService.canAccessChannel("KITCHEN_EMPLOYEE", branchA, `vehicle_telemetry:${branchA}`)
      ).toBe(false);
      expect(
        realtimeService.canAccessChannel("CASHIER", branchA, `vehicle_telemetry:${branchA}`)
      ).toBe(false);
    });
  });

  // ── 5. Driver Data Minimization ─────────────────────────────────────────────

  describe("5. Driver Data Minimization via DeliveryViewDTO (PHASE 00 Section 31)", () => {
    it("DeliveryViewDTO masks sensitive customer CRM data, spend, and tags", () => {
      const mockDelivery: any = {
        id: "del-777",
        tenant_id: tenantA,
        branch_id: branchA,
        order_id: "ord-777",
        status: "OUT_FOR_DELIVERY",
        priority: "NORMAL",
        delivery_address: {
          street: "Rothschild",
          houseNumber: "10",
          city: "Tel Aviv",
          gateCode: "1234",
          deliveryNotes: "Leave by door",
        },
        customer_notes: "Leave by door",
        delivery_notes: "Gate code: 1234",
        customer_lifetime_spend: 15400,
        crm_tags: ["VIP", "COMPLAINER", "ALLERGIC_PEANUT"],
        internal_kitchen_notes: "Customer is sensitive to delay",
      };

      const viewDTO = deliveryService.toDeliveryViewDTO(mockDelivery);

      // Permitted operational fields
      expect(viewDTO.id).toBe("del-777");
      expect(viewDTO.deliveryAddress.street).toBe("Rothschild");
      expect(viewDTO.deliveryAddress.gateCode).toBe("1234");
      expect(viewDTO.customerNotes).toBe("Leave by door");

      // Forbidden sensitive fields must NOT be present
      expect((viewDTO as any).customer_lifetime_spend).toBeUndefined();
      expect((viewDTO as any).crm_tags).toBeUndefined();
      expect((viewDTO as any).internal_kitchen_notes).toBeUndefined();
      expect((viewDTO as any).payment_method).toBeUndefined();

      // Verify CRM-level customer masking
      const crmDTO = toCrmDeliveryViewDTO(
        {
          id: "cust-1",
          first_name: "David",
          last_name: "Cohen",
          phone: "+972541112233",
          email: "david@cohen.com",
          tenant_id: tenantA,
          created_at: new Date(),
          updated_at: new Date(),
          total_spend: 15400,
          tags: ["VIP"],
        } as any,
        {
          street: "Rothschild",
          house_number: "10",
          city: "Tel Aviv",
          gate_code: "1234",
        } as any
      );

      expect(crmDTO.customerDisplayName).toBe("David Cohen");
      expect(crmDTO.contactPhoneMasked).toBe("+97-***2233");
      expect((crmDTO as any).total_spend).toBeUndefined();
      expect((crmDTO as any).tags).toBeUndefined();
    });
  });

  // ── 6. Fleet Telemetry Privacy & Retention ─────────────────────────────────

  describe("6. Fleet Telemetry Privacy & Shift-bound Tracking (PHASE 00 Section 42)", () => {
    it("rejects telemetry ingestion if vehicle's assigned driver is OFF_SHIFT", async () => {
      // 1. Create vehicle and mount tracker
      const vehicle = await fleetService.createVehicle(tenantA, branchA, {
        vehicleType: "SCOOTER",
        licensePlate: "PRIV-101",
      });

      const trackerId = "trk-privacy-01";
      await fleetService.assignTrackerToVehicle(tenantA, vehicle.id, trackerId, "admin-1");

      // 2. Assign driver who is OFF_SHIFT
      const driver = memoryDb.insert("delivery_drivers", {
        id: "drv-off-shift-99",
        tenant_id: tenantA,
        user_id: "usr-off-99",
        name: "Off Duty Driver",
        phone: "+972509999999",
        shift_status: "OFF_SHIFT",
        assignment_status: "UNAVAILABLE",
        is_active: true,
      });

      await fleetService.assignDriverToVehicle(tenantA, driver.id, vehicle.id, "admin-1");

      // 3. Telemetry ingestion must be rejected to prevent employee surveillance
      await expect(
        fleetService.ingestTelemetry(tenantA, {
          trackerId,
          latitude: 32.085,
          longitude: 34.781,
          recordedAt: new Date(),
        })
      ).rejects.toThrow(/TELEMETRY_PRIVACY_VIOLATION.*outside active driver shift/i);
    });

    it("purges telemetry older than 30 days according to data retention policy", async () => {
      const now = Date.now();
      const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000);

      memoryDb.insert("vehicle_locations", {
        id: "loc-old-1",
        tenant_id: tenantA,
        tracker_id: "trk-01",
        latitude: 32.08,
        longitude: 34.78,
        recorded_at: fortyDaysAgo,
      });

      memoryDb.insert("vehicle_locations", {
        id: "loc-recent-1",
        tenant_id: tenantA,
        tracker_id: "trk-01",
        latitude: 32.09,
        longitude: 34.79,
        recorded_at: fiveDaysAgo,
      });

      const purgedCount = await fleetService.purgeStaleTelemetry(tenantA, 30);
      expect(purgedCount).toBe(1);

      const remaining = memoryDb.find("vehicle_locations", (l: any) => l.tenant_id === tenantA);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("loc-recent-1");
    });
  });

  // ── 7. Zero Credential Leakage in Audit Trail ──────────────────────────────

  describe("7. Zero Credential Leakage in Audit Trail", () => {
    it("redacts passwords, tokens, API secrets, and payment PAN/CVV from audit logs", async () => {
      const sensitivePayload = {
        username: "admin_user",
        password: "PlainPassword123!",
        pin_code_hash: "hash12345",
        token: "jwt_token_secret_data",
        access_token: "oauth_access_secret",
        session_token: "sess_xyz123",
        credit_card: "4580123456789012",
        pan: "4580123456789012",
        cvv: "789",
        sip_password: "super_sip_secret",
        client_secret: "prod_oauth_client_secret",
        validNonSensitiveField: "Safe Data",
      };

      const sanitized = sanitizeAuditData(sensitivePayload);

      expect(sanitized.username).toBe("admin_user");
      expect(sanitized.validNonSensitiveField).toBe("Safe Data");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.pin_code_hash).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.access_token).toBe("[REDACTED]");
      expect(sanitized.session_token).toBe("[REDACTED]");
      expect(sanitized.credit_card).toBe("[REDACTED]");
      expect(sanitized.pan).toBe("[REDACTED]");
      expect(sanitized.cvv).toBe("[REDACTED]");
      expect(sanitized.sip_password).toBe("[REDACTED]");
      expect(sanitized.client_secret).toBe("[REDACTED]");
    });
  });

  // ── 8. Application Security & Webhook Defense ───────────────────────────────

  describe("8. File Upload, Path Traversal & Webhook Replay Defense", () => {
    it("rejects path traversal attempts in uploaded filenames", () => {
      const dummyPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = validateFileUpload({
        buffer: dummyPng,
        filename: "../../../../../etc/passwd.png",
      });

      expect(res.valid).toBe(true);
      // Path traversal segments must be stripped out completely
      expect(res.sanitizedFilename).not.toContain("..");
      expect(res.sanitizedFilename).not.toContain("/");
      expect(res.sanitizedFilename).not.toContain("\\");
    });

    it("rejects executable files disguised with fake image extensions", () => {
      const fakePngExecutable = Buffer.from("MZ\x90\x00\x03\x00\x00\x00EXE_PAYLOAD");
      const res = validateFileUpload({
        buffer: fakePngExecutable,
        filename: "receipt.png",
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/unable to identify|magic number|unrecognized/i);
    });

    it("rejects replayed webhook requests outside the timestamp tolerance window", () => {
      const secret = "webhook_test_secret_123";
      const body = JSON.stringify({ event: "delivery.completed", id: "del-1" });
      const { createHmac } = require("crypto");
      const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

      const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const verifyRes = verifyWebhookSignature({
        body,
        signature: sig,
        secret,
        timestamp: staleTimestamp,
        toleranceSeconds: 300,
      });

      expect(verifyRes.valid).toBe(false);
      expect(verifyRes.reason).toMatch(/stale|replay/i);
    });
  });
});
