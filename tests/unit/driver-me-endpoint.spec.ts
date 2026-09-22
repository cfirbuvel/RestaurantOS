import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { NextRequest } from "next/server";
import { GET as getDriverMeRoute } from "@/app/api/v1/drivers/me/route";

describe("Phase 15.1: Driver Self-Profile Endpoint (GET /api/v1/drivers/me)", () => {
  const tenantId = "org_driver_test";
  const restaurantId = "rest_driver_test";
  const branchId = "branch_driver_tlv";
  const driverUserId = "usr_driver_alon";
  const validToken = "valid_drv_token";

  beforeEach(() => {
    memoryDb.reset();

    // Seed user
    memoryDb.insert("users", {
      id: driverUserId,
      organization_id: tenantId,
      first_name: "Alon",
      last_name: "Levi",
      role: "DRIVER",
      email: "alon@restaurantos.test",
      is_active: true,
    });

    // Seed user org
    memoryDb.insert("user_organizations", {
      user_id: driverUserId,
      organization_id: tenantId,
      role: "DRIVER",
    });

    // Seed user branch assignment
    memoryDb.insert("user_branch_assignments", {
      user_id: driverUserId,
      organization_id: tenantId,
      restaurant_id: restaurantId,
      branch_id: branchId,
      role: "DRIVER",
      is_primary: true,
    });

    // Seed session for driver
    memoryDb.insert("sessions", {
      id: "sess_driver_valid",
      user_id: driverUserId,
      token: validToken,
      role: "DRIVER",
      tenant_id: tenantId,
      organization_id: tenantId,
      branch_id: branchId,
      permissions: ["delivery.read", "delivery.write", "delivery.self_assign"],
      created_at: new Date(),
      expires_at: new Date(Date.now() + 86400000),
    });
  });

  it("should return 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/drivers/me", {
      method: "GET",
    });

    const res = await getDriverMeRoute(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should auto-create driver record on first access and return 200", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/drivers/me", {
      method: "GET",
      headers: {
        authorization: `Bearer ${validToken}`,
        "x-tenant-id": tenantId,
        "x-branch-id": branchId,
      },
    });

    const res = await getDriverMeRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.driver).toBeDefined();
    expect(body.driver.user_id).toBe(driverUserId);
    expect(body.driver.tenant_id).toBe(tenantId);
    expect(body.driver.branch_id).toBe(branchId);
    expect(body.driver.shift_status).toBe("OFF_SHIFT");
    expect(body.driver.assignment_status).toBe("AVAILABLE");
    expect(body.driver.trip_status).toBe("NOT_STARTED");
    expect(body.driver.can_self_assign).toBe(true);
  });

  it("should return existing driver record on subsequent accesses", async () => {
    // Pre-insert an existing driver record
    const existingDriver = {
      id: "drv_existing_alon",
      tenant_id: tenantId,
      branch_id: branchId,
      user_id: driverUserId,
      shift_status: "ON_SHIFT",
      assignment_status: "ASSIGNED",
      trip_status: "IN_TRANSIT",
      available_since: new Date().toISOString(),
      is_active: true,
      can_self_assign: true,
      can_self_batch: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    memoryDb.insert("drivers", existingDriver);

    const req = new NextRequest("http://localhost:3000/api/v1/drivers/me", {
      method: "GET",
      headers: {
        authorization: `Bearer ${validToken}`,
        "x-tenant-id": tenantId,
        "x-branch-id": branchId,
      },
    });

    const res = await getDriverMeRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.driver).toBeDefined();
    expect(body.driver.id).toBe("drv_existing_alon");
    expect(body.driver.shift_status).toBe("ON_SHIFT");
    expect(body.driver.assignment_status).toBe("ASSIGNED");
    expect(body.driver.trip_status).toBe("IN_TRANSIT");
  });
});
