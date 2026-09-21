import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { branchService } from "@/modules/identity/domain/branch";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";
import { notificationService } from "@/modules/notifications/notification-service";
import { orderService } from "@/modules/orders/services/order-service";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { NextRequest } from "next/server";
import { GET as getBranchesRoute } from "@/app/api/v1/branches/route";
import { GET as getDriversRoute } from "@/app/api/v1/drivers/route";
import { GET as getOperationalOverviewRoute } from "@/app/api/v1/analytics/operational-overview/route";
import { GET as getNotificationsRoute } from "@/app/api/v1/notifications/route";
import { POST as postDeviceTokenRoute } from "@/app/api/v1/notifications/device-token/route";

describe("Phase 14: Manager App API Endpoints & Operational Services", () => {
  const tenantId = "org_manager_test";
  const restaurantId = "rest_manager_test";
  const branchId = "branch_manager_tlv";
  const managerUserId = "usr_manager_dan";

  beforeEach(() => {
    memoryDb.reset();

    // Seed user
    memoryDb.insert("users", {
      id: managerUserId,
      organization_id: tenantId,
      first_name: "Dan",
      last_name: "Cohen",
      role: "MANAGER",
      email: "dan@restaurantos.test",
      is_active: true,
    });

    // Seed user organization
    memoryDb.insert("user_organizations", {
      user_id: managerUserId,
      organization_id: tenantId,
      role: "MANAGER",
    });

    // Seed user branch assignment
    memoryDb.insert("user_branch_assignments", {
      user_id: managerUserId,
      organization_id: tenantId,
      restaurant_id: restaurantId,
      branch_id: branchId,
      role: "MANAGER",
      is_primary: true,
    });

    // Seed session for manager
    memoryDb.insert("sessions", {
      id: "sess_manager_valid",
      user_id: managerUserId,
      token: "valid_mgr_token",
      role: "MANAGER",
      tenant_id: tenantId,
      organization_id: tenantId,
      branch_id: branchId,
      expires_at: new Date(Date.now() + 86400000),
      is_active: true,
      created_at: new Date(),
    });
  });

  it("BranchService: should create and list branches for authenticated organization", async () => {
    const b1 = await branchService.createBranch({
      organizationId: tenantId,
      restaurantId,
      name: "Tel Aviv Central",
      slug: "tlv-central",
      phone: "03-5551234",
    });

    const b2 = await branchService.createBranch({
      organizationId: tenantId,
      restaurantId,
      name: "Haifa Port",
      slug: "haifa-port",
      phone: "04-5555678",
    });

    const list = await branchService.listBranches(tenantId);
    expect(list).toHaveLength(2);
    expect(list.map((b) => b.name)).toContain("Tel Aviv Central");
    expect(list.map((b) => b.name)).toContain("Haifa Port");

    // Route handler test
    const req = new NextRequest("http://localhost/api/v1/branches", {
      headers: {
        authorization: "Bearer valid_mgr_token",
        "x-tenant-id": tenantId,
      },
    });

    const res = await getBranchesRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.branches).toHaveLength(2);
  });

  it("Driver Management: should return comprehensive branch driver roster across shift states", async () => {
    // Clock in 2 drivers
    const d1 = await driverQueueService.clockIn(tenantId, branchId, "usr_driver_1");
    const d2 = await driverQueueService.clockIn(tenantId, branchId, "usr_driver_2");

    // Driver 2 goes on break
    await driverQueueService.startBreak(tenantId, branchId, "usr_driver_2");

    const allDrivers = await driverQueueService.getAllBranchDrivers(tenantId, branchId);
    expect(allDrivers).toHaveLength(2);

    const activeD = allDrivers.find((d) => d.userId === "usr_driver_1");
    const breakD = allDrivers.find((d) => d.userId === "usr_driver_2");

    expect(activeD.shiftStatus).toBe("ON_SHIFT");
    expect(activeD.assignmentStatus).toBe("AVAILABLE");
    expect(breakD.shiftStatus).toBe("BREAK");

    // Route handler test
    const req = new NextRequest(`http://localhost/api/v1/drivers?branchId=${branchId}`, {
      headers: {
        authorization: "Bearer valid_mgr_token",
        "x-tenant-id": tenantId,
      },
    });

    const res = await getDriversRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.drivers).toHaveLength(2);
  });

  it("Operational Overview: should calculate real-time counts and generate operational alerts", async () => {
    // Seed branch
    await branchService.createBranch({
      organizationId: tenantId,
      restaurantId,
      name: "Tel Aviv Central",
      slug: "tlv-central",
    });

    // Insert sample orders in memoryDb
    memoryDb.insert("orders", {
      id: "ord_active_1",
      tenant_id: tenantId,
      branch_id: branchId,
      status: "IN_PREPARATION",
      channel: "WEB",
      order_type: "DELIVERY",
      created_at: new Date(),
    });

    // Create an unassigned ready delivery with no available drivers
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: "ord_deliv_test",
      deliveryAddress: {
        street: "Dizengoff",
        houseNumber: "50",
        city: "Tel Aviv",
        location: { lat: 32.078, lng: 34.774 },
      },
    });
    memoryDb.update("deliveries", delivery.id, { status: "AVAILABLE_FOR_ASSIGNMENT" });

    // Call route
    const req = new NextRequest(`http://localhost/api/v1/analytics/operational-overview?branchId=${branchId}`, {
      headers: {
        authorization: "Bearer valid_mgr_token",
        "x-tenant-id": tenantId,
      },
    });

    const res = await getOperationalOverviewRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.orders.todayCount).toBeGreaterThanOrEqual(1);
    expect(data.deliveries.waitingCount).toBeGreaterThanOrEqual(1);
    expect(data.deliveries.unassignedCount).toBeGreaterThanOrEqual(1);
    // Alert should be generated for no available drivers
    expect(data.alerts.length).toBeGreaterThanOrEqual(1);
    expect(data.alerts[0].id).toBe("alert_no_drivers");
  });

  it("Notifications & Push: should register device token and fetch in-app staff notifications", async () => {
    // Register device token
    const tokenReq = new NextRequest("http://localhost/api/v1/notifications/device-token", {
      method: "POST",
      headers: {
        authorization: "Bearer valid_mgr_token",
        "x-tenant-id": tenantId,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: "fcm_test_device_token_xyz",
        platform: "ANDROID",
      }),
    });

    const tokenRes = await postDeviceTokenRoute(tokenReq);
    expect(tokenRes.status).toBe(200);

    // Send in-app notification to manager
    await notificationService.send({
      tenantId,
      recipientId: managerUserId,
      title: "Delivery Overdue",
      body: "Delivery #482 is exceeding promised SLA",
      channels: ["IN_APP"],
    });

    // Fetch notifications
    const fetchReq = new NextRequest("http://localhost/api/v1/notifications", {
      headers: {
        authorization: "Bearer valid_mgr_token",
        "x-tenant-id": tenantId,
      },
    });

    const fetchRes = await getNotificationsRoute(fetchReq);
    expect(fetchRes.status).toBe(200);
    const json = await fetchRes.json();
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].title).toBe("Delivery Overdue");
  });
});
