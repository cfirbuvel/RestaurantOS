import { describe, it, expect, beforeEach } from "vitest";
import { notificationService, MockPushProvider } from "@/modules/notifications/notification-service";

describe("Phase 17 — Notification Security & Boundary Tests", () => {
  const tenantA = "tenant_alpha";
  const tenantB = "tenant_beta";

  const userA = "usr_manager_alpha";
  const userB = "usr_manager_beta";

  const driverA = "drv_john_alpha";
  const driverB = "drv_mike_beta";

  beforeEach(() => {
    notificationService.clear();
  });

  describe("1. Strict Tenant Isolation (RLS / Tenant Boundary)", () => {
    it("ensures User in Tenant A cannot query or read Tenant B notifications", async () => {
      // Notification for Tenant A
      await notificationService.dispatchActionableNotification({
        tenantId: tenantA,
        branchId: "branch_a1",
        recipientId: userA,
        type: "ORDER_ISSUE",
        priority: "HIGH",
        title: "Tenant A Order Issue",
        body: "Conflicting modifiers",
        targetEntity: { type: "ORDER", id: "ord_a1" },
      });

      // Notification for Tenant B
      const notifB = await notificationService.dispatchActionableNotification({
        tenantId: tenantB,
        branchId: "branch_b1",
        recipientId: userB,
        type: "ORDER_ISSUE",
        priority: "HIGH",
        title: "Tenant B Order Issue",
        body: "Item cancellation",
        targetEntity: { type: "ORDER", id: "ord_b1" },
      });

      // Query from Tenant A
      const listA = await notificationService.getNotifications(tenantA, userA);
      expect(listA).toHaveLength(1);
      expect(listA[0].title).toBe("Tenant A Order Issue");

      // Query from Tenant B
      const listB = await notificationService.getNotifications(tenantB, userB);
      expect(listB).toHaveLength(1);
      expect(listB[0].title).toBe("Tenant B Order Issue");

      // User A attempting to mark Tenant B notification as read must fail
      const illegalMark = await notificationService.markAsRead(notifB!.id, tenantA, userA);
      expect(illegalMark).toBe(false);
    });
  });

  describe("2. Recipient Role & Boundary Isolation", () => {
    it("prevents driver from receiving or viewing manager alerts", async () => {
      // Manager Alert
      await notificationService.dispatchActionableNotification({
        tenantId: tenantA,
        branchId: "branch_a1",
        recipientId: userA, // Manager
        type: "INTEGRATION_FAILURE",
        priority: "CRITICAL",
        title: "Wolt Webhook Failed",
        body: "Authentication handshake rejected",
        targetEntity: { type: "ALERT", id: "alt_wolt_down" },
      });

      // Driver query
      const driverList = await notificationService.getNotifications(tenantA, driverA);
      expect(driverList).toHaveLength(0);

      // Driver attempting to mark manager notification as read must fail
      const illegalMark = await notificationService.markAsRead("alt_wolt_down", tenantA, driverA);
      expect(illegalMark).toBe(false);
    });

    it("prevents driver from seeing other drivers' delivery assignments", async () => {
      // Driver A assignment
      await notificationService.dispatchActionableNotification({
        tenantId: tenantA,
        branchId: "branch_a1",
        recipientId: driverA,
        type: "NEW_DELIVERY_ASSIGNMENT",
        priority: "HIGH",
        title: "Assigned Delivery #50",
        body: "Head to 10 Herzl St",
        targetEntity: { type: "DELIVERY", id: "del_50" },
      });

      // Driver B query in same tenant
      const otherDriverList = await notificationService.getNotifications(tenantA, "drv_sam_alpha");
      expect(otherDriverList).toHaveLength(0);
    });
  });

  describe("3. Zero-PII Payload Invariant", () => {
    it("validates that push notifications do not carry sensitive credit card, CVV, or passwords", async () => {
      await notificationService.registerDeviceToken(driverA, "push_token_drv_a", "ANDROID_DRIVER");

      await notificationService.dispatchActionableNotification({
        tenantId: tenantA,
        branchId: "branch_a1",
        recipientId: driverA,
        type: "NEW_DELIVERY_ASSIGNMENT",
        priority: "HIGH",
        title: "New Delivery Assigned",
        body: "Order ready for pickup",
        targetEntity: { type: "DELIVERY", id: "del_80" },
        data: {
          destinationArea: "North District",
          // Sensitive fields should NEVER be included
        },
      });

      const pushProvider = notificationService.getProvider<MockPushProvider>("PUSH");
      expect(pushProvider?.sentPush).toHaveLength(1);

      const payload = pushProvider?.sentPush[0];
      const serialized = JSON.stringify(payload);

      // Ensure no sensitive keywords exist
      expect(serialized).not.toContain("creditCard");
      expect(serialized).not.toContain("cvv");
      expect(serialized).not.toContain("password");
      expect(serialized).not.toContain("token_secret");
    });
  });
});
