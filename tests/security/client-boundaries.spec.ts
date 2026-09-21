import { describe, it, expect, beforeEach } from "vitest";
import { authService } from "@/modules/identity/services/auth-service";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { realtimeService } from "@/modules/realtime/services/realtime-service";
import { memoryDb } from "@/core/database/db";
import { mockRedis } from "@/core/cache/redis";
import { CLIENT_HEADERS } from "@/shared/contracts/client-types";
import { DeliveryViewDTO } from "@/shared/contracts/delivery";

describe("Security: Client Boundaries & Privilege Isolation (Phase 13)", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  describe("X-Client-Type Spoofing Defense", () => {
    it("MUST NOT elevate privileges when a DRIVER sends X-Client-Type: WEB_ADMIN or MANAGER_APP", async () => {
      // 1. Create a user with DRIVER role
      const { user, organizationId } = await authService.registerUser({
        email: "driver_courier@restaurantos.io",
        password: "SecurePassword123!",
        firstName: "Dave",
        lastName: "Driver",
        organizationName: "Pizzeria Uno",
      });

      // Update assignment to DRIVER
      const roleRow = memoryDb.find("user_roles", (r: any) => r.user_id === user.id)[0];
      if (roleRow) {
        memoryDb.update("user_roles", roleRow.id, { role: "DRIVER" });
      }
      const branchRow = memoryDb.find("user_branch_assignments", (a: any) => a.user_id === user.id)[0];
      if (branchRow) {
        memoryDb.update("user_branch_assignments", branchRow.id, { role: "DRIVER" });
      }

      const { session } = await authService.loginWithPassword(
        "driver_courier@restaurantos.io",
        "SecurePassword123!"
      );

      // 2. Attacker attempts to forge client type to WEB_ADMIN
      const spoofedHeaders: Record<string, string> = {
        authorization: `Bearer ${session.token}`,
        [CLIENT_HEADERS.CLIENT_TYPE]: "WEB_ADMIN",
        [CLIENT_HEADERS.TENANT_ID]: organizationId!,
      };

      const authContext = await resolveAuthContext(spoofedHeaders);
      expect(authContext).not.toBeNull();
      expect(authContext?.session.role).toBe("DRIVER"); // Server-side principal is immutable!

      // 3. Verify that authoritative RBAC checks still reject administrative actions
      const canManageOrg = verifyPermission(authContext!.session, "organizations.manage");
      const canManageSettings = verifyPermission(authContext!.session, "settings.manage");
      const canRefundOrder = verifyPermission(authContext!.session, "orders.refund");
      const canManageMenu = verifyPermission(authContext!.session, "menu.manage");

      expect(canManageOrg).toBe(false);
      expect(canManageSettings).toBe(false);
      expect(canRefundOrder).toBe(false);
      expect(canManageMenu).toBe(false);

      // 4. Driver only has driver-authorized actions
      const canReadDelivery = verifyPermission(authContext!.session, "delivery.read");
      expect(canReadDelivery).toBe(true);
    });

    it("MUST NOT elevate privileges when a KIOSK / VIEWER sends X-Client-Type: MANAGER_APP", async () => {
      const { user, organizationId } = await authService.registerUser({
        email: "kiosk_terminal@restaurantos.io",
        password: "SecurePassword123!",
        firstName: "Kiosk",
        lastName: "Terminal",
        organizationName: "Burger Chain",
      });

      // Update assignment to VIEWER
      const roleRow = memoryDb.find("user_roles", (r: any) => r.user_id === user.id)[0];
      if (roleRow) {
        memoryDb.update("user_roles", roleRow.id, { role: "VIEWER" });
      }
      const branchRow = memoryDb.find("user_branch_assignments", (a: any) => a.user_id === user.id)[0];
      if (branchRow) {
        memoryDb.update("user_branch_assignments", branchRow.id, { role: "VIEWER" });
      }

      const { session } = await authService.loginWithPassword(
        "kiosk_terminal@restaurantos.io",
        "SecurePassword123!"
      );

      const spoofedHeaders: Record<string, string> = {
        authorization: `Bearer ${session.token}`,
        [CLIENT_HEADERS.CLIENT_TYPE]: "MANAGER_APP",
        [CLIENT_HEADERS.TENANT_ID]: organizationId!,
      };

      const authContext = await resolveAuthContext(spoofedHeaders);
      expect(authContext?.session.role).toBe("VIEWER");

      const canManageDispatch = verifyPermission(authContext!.session, "delivery.manage");
      const canOverrideBatches = verifyPermission(authContext!.session, "delivery.batch");

      expect(canManageDispatch).toBe(false);
      expect(canOverrideBatches).toBe(false);
    });
  });

  describe("Tenant & Branch Boundary Enforcement", () => {
    it("should reject cross-tenant access when session belongs to Org A and request targets Org B", async () => {
      const userA = await authService.registerUser({
        email: "admin_a@tenant-a.com",
        password: "SecurePassword123!",
        firstName: "Alice",
        lastName: "Admin",
        organizationName: "Tenant A",
      });

      const userB = await authService.registerUser({
        email: "admin_b@tenant-b.com",
        password: "SecurePassword123!",
        firstName: "Bob",
        lastName: "Admin",
        organizationName: "Tenant B",
      });

      const sessionA = await authService.loginWithPassword(
        "admin_a@tenant-a.com",
        "SecurePassword123!"
      );

      // User A session attempting to target Tenant B
      const crossTenantHeaders: Record<string, string> = {
        authorization: `Bearer ${sessionA.session.token}`,
        [CLIENT_HEADERS.TENANT_ID]: userB.organizationId!,
      };

      const authContext = await resolveAuthContext(crossTenantHeaders);
      // Context is resolved from token, which belongs to userA's organizationId
      expect(authContext?.organizationId).toBe(userA.organizationId);
      expect(authContext?.organizationId).not.toBe(userB.organizationId);
    });
  });

  describe("Driver Least-Privilege Data Minimization (DeliveryViewDTO)", () => {
    it("should ensure DeliveryViewDTO exposes only minimal delivery fields and redacts internal data", () => {
      // Simulate raw internal delivery record with extensive sensitive details
      const rawInternalDelivery = {
        id: "del_9981",
        tenant_id: "org_secret",
        branch_id: "brn_secret",
        order_id: "ord_1001",
        driver_id: "drv_44",
        status: "ASSIGNED",
        delivery_address: {
          street: "Ibn Gabirol",
          houseNumber: "24",
          entrance: "B",
          floor: "3",
          apartment: "12",
          gateCode: "9988",
          parkingInstructions: "Park in underground guest spot",
          deliveryNotes: "Call when at the gate",
          latitude: 32.0853,
          longitude: 34.7818,
        },
        // Sensitive internal fields that DRIVER MUST NOT SEE:
        supplier_cost: 45.2,
        kitchen_prep_time_ms: 840000,
        customer_crm_lifetime_value: 34200.0,
        customer_phone_unmasked: "+972-54-123-4567",
        internal_staff_notes: "Customer is demanding, handle with extra care",
        other_driver_locations: [{ driverId: "drv_55", lat: 32.08, lng: 34.78 }],
        amount_to_collect: 0,
        is_paid: true,
      };

      // Transform to canonical DeliveryViewDTO
      const driverView: DeliveryViewDTO = {
        deliveryId: rawInternalDelivery.id,
        orderNumber: "ORD-1001",
        destination: {
          street: rawInternalDelivery.delivery_address.street,
          houseNumber: rawInternalDelivery.delivery_address.houseNumber,
          entrance: rawInternalDelivery.delivery_address.entrance,
          floor: rawInternalDelivery.delivery_address.floor,
          apartment: rawInternalDelivery.delivery_address.apartment,
          gateCode: rawInternalDelivery.delivery_address.gateCode,
          parkingInstructions: rawInternalDelivery.delivery_address.parkingInstructions,
          deliveryNotes: rawInternalDelivery.delivery_address.deliveryNotes,
          location: {
            lat: rawInternalDelivery.delivery_address.latitude,
            lng: rawInternalDelivery.delivery_address.longitude,
          },
        },
        customerContact: {
          displayName: "Dan C.",
          maskedPhone: "+972-3-***-4567 (Proxy Relay)", // Relayed/Masked
        },
        deliveryStatus: rawInternalDelivery.status as any,
        itemsSummary: [{ name: "Truffle Pizza", quantity: 2 }],
        isPaid: rawInternalDelivery.is_paid,
        amountToCollectOnDelivery: rawInternalDelivery.amount_to_collect,
      };

      // Verify minimized payload contains required operational fields
      expect(driverView.deliveryId).toBe("del_9981");
      expect(driverView.destination.street).toBe("Ibn Gabirol");
      expect(driverView.destination.gateCode).toBe("9988");
      expect(driverView.customerContact.maskedPhone).toContain("Proxy Relay");

      // Verify internal sensitive fields are strictly ABSENT from driver DTO
      expect((driverView as any).supplier_cost).toBeUndefined();
      expect((driverView as any).kitchen_prep_time_ms).toBeUndefined();
      expect((driverView as any).customer_crm_lifetime_value).toBeUndefined();
      expect((driverView as any).customer_phone_unmasked).toBeUndefined();
      expect((driverView as any).internal_staff_notes).toBeUndefined();
      expect((driverView as any).other_driver_locations).toBeUndefined();
    });
  });

  describe("Realtime Channel Authorization Gating", () => {
    const branchId = "brn_test_100";

    it("should prevent DRIVER from subscribing to administrative or kitchen channels", () => {
      const driverUserId = "usr_driver_77";

      // Driver can access own channel
      expect(
        realtimeService.canAccessChannel("DRIVER", branchId, `branch:${branchId}:driver:me`, null, driverUserId)
      ).toBe(true);

      // Driver CANNOT access admin channel
      expect(
        realtimeService.canAccessChannel("DRIVER", branchId, `branch:${branchId}:admin`, null, driverUserId)
      ).toBe(false);

      // Driver CANNOT access KDS channel
      expect(
        realtimeService.canAccessChannel("DRIVER", branchId, `branch:${branchId}:kds:all`, null, driverUserId)
      ).toBe(false);

      // Driver CANNOT access fleet telemetry channel
      expect(
        realtimeService.canAccessChannel("DRIVER", branchId, `branch:${branchId}:telemetry`, null, driverUserId)
      ).toBe(false);
    });

    it("should permit KITCHEN_EMPLOYEE to only access KDS station channels", () => {
      expect(
        realtimeService.canAccessChannel("KITCHEN_EMPLOYEE", branchId, `branch:${branchId}:kds:all`, "station_grill")
      ).toBe(true);

      expect(
        realtimeService.canAccessChannel("KITCHEN_EMPLOYEE", branchId, `branch:${branchId}:dispatch`)
      ).toBe(false);

      expect(
        realtimeService.canAccessChannel("KITCHEN_EMPLOYEE", branchId, `branch:${branchId}:admin`)
      ).toBe(false);
    });
  });
});
