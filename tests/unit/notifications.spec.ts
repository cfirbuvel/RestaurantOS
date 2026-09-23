import { describe, it, expect, beforeEach } from "vitest";
import { notificationService, MockPushProvider } from "@/modules/notifications/notification-service";
import { NotificationType, NotificationPriority } from "@/shared/contracts/notifications";

describe("Phase 17 — Unified Notification Service Unit Tests", () => {
  const tenantId = "org_alpha";
  const branchId = "branch_central";
  const userId = "usr_manager_1";

  beforeEach(() => {
    notificationService.clear();
  });

  describe("1. Actionable Notification Types & Payload Verification", () => {
    const requiredTypes: NotificationType[] = [
      "NEW_DELIVERY_ASSIGNMENT",
      "DELIVERY_REASSIGNMENT",
      "DELIVERY_OVERDUE",
      "NO_AVAILABLE_DRIVER",
      "KDS_SLA_BREACH",
      "ORDER_ISSUE",
      "PAYMENT_ISSUE",
      "INTEGRATION_FAILURE",
      "SYSTEM_ALERT",
      "MANAGER_MESSAGE",
    ];

    it.each(requiredTypes)("dispatches valid actionable notification for type '%s'", async (type) => {
      const envelope = await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type,
        priority: "HIGH",
        title: `Test Alert: ${type}`,
        body: `Action required for ${type}`,
        targetEntity: {
          type: type.includes("DELIVERY") ? "DELIVERY" : type.includes("KDS") ? "KDS_TICKET" : "ORDER",
          id: "entity_999",
        },
      });

      expect(envelope).not.toBeNull();
      expect(envelope?.id).toBeDefined();
      expect(envelope?.type).toBe(type);
      expect(envelope?.priority).toBe("HIGH");
      expect(envelope?.read).toBe(false);
      expect(envelope?.deepLink).toMatch(/^restaurantos:\/\//);
      expect(envelope?.timestamp).toBeDefined();

      const notifs = await notificationService.getNotifications(tenantId, userId);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].id).toBe(envelope?.id);
    });
  });

  describe("2. Deduplication Sliding Window", () => {
    it("suppresses duplicate notifications with identical deduplicationKey within the window", async () => {
      const dedupKey = "overdue_delivery_del_100";

      const first = await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "DELIVERY_OVERDUE",
        priority: "CRITICAL",
        title: "Delivery Overdue",
        body: "Delivery #100 is 15 minutes late",
        targetEntity: { type: "DELIVERY", id: "del_100" },
        deduplicationKey: dedupKey,
      });

      expect(first).not.toBeNull();

      // Second attempt with exact same key must be suppressed
      const second = await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "DELIVERY_OVERDUE",
        priority: "CRITICAL",
        title: "Delivery Overdue (Repeat)",
        body: "Delivery #100 is 15 minutes late",
        targetEntity: { type: "DELIVERY", id: "del_100" },
        deduplicationKey: dedupKey,
      });

      expect(second).toBeNull();

      // Only one in-app notification should exist
      const list = await notificationService.getNotifications(tenantId, userId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(first?.id);
    });

    it("allows distinct deduplication keys", async () => {
      await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "DELIVERY_OVERDUE",
        priority: "CRITICAL",
        title: "Delivery 1",
        body: "Order late",
        targetEntity: { type: "DELIVERY", id: "del_1" },
        deduplicationKey: "overdue:del_1",
      });

      await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "DELIVERY_OVERDUE",
        priority: "CRITICAL",
        title: "Delivery 2",
        body: "Order late",
        targetEntity: { type: "DELIVERY", id: "del_2" },
        deduplicationKey: "overdue:del_2",
      });

      const list = await notificationService.getNotifications(tenantId, userId);
      expect(list).toHaveLength(2);
    });
  });

  describe("3. Expiration & Stale Notification Filtering", () => {
    it("filters out expired notifications from query results", async () => {
      // 1. Create already-expired notification
      await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "KDS_SLA_BREACH",
        priority: "CRITICAL",
        title: "Past Breach",
        body: "Station expired",
        targetEntity: { type: "KDS_TICKET", id: "ticket_old" },
        expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 min ago
      });

      // 2. Create active notification (expires in 10 minutes)
      await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "KDS_SLA_BREACH",
        priority: "CRITICAL",
        title: "Active Breach",
        body: "Station alert",
        targetEntity: { type: "KDS_TICKET", id: "ticket_new" },
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });

      const list = await notificationService.getNotifications(tenantId, userId);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("Active Breach");
    });
  });

  describe("4. Read State Operations", () => {
    it("marks single notification as read", async () => {
      const envelope = await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "ORDER_ISSUE",
        priority: "HIGH",
        title: "Item out of stock",
        body: "Avocado depleted",
        targetEntity: { type: "ORDER", id: "ord_55" },
      });

      expect(envelope).not.toBeNull();
      const notifId = envelope!.id;

      let list = await notificationService.getNotifications(tenantId, userId, 50, { unreadOnly: true });
      expect(list).toHaveLength(1);

      const success = await notificationService.markAsRead(notifId, tenantId, userId);
      expect(success).toBe(true);

      list = await notificationService.getNotifications(tenantId, userId, 50, { unreadOnly: true });
      expect(list).toHaveLength(0);

      const all = await notificationService.getNotifications(tenantId, userId);
      expect(all[0].read).toBe(true);
      expect(all[0].readAt).toBeDefined();
    });

    it("marks all notifications as read in bulk", async () => {
      for (let i = 1; i <= 3; i++) {
        await notificationService.dispatchActionableNotification({
          tenantId,
          branchId,
          recipientId: userId,
          type: "SYSTEM_ALERT",
          priority: "LOW",
          title: `Alert ${i}`,
          body: `Message ${i}`,
          targetEntity: { type: "ALERT", id: `alt_${i}` },
        });
      }

      let unread = await notificationService.getNotifications(tenantId, userId, 50, { unreadOnly: true });
      expect(unread).toHaveLength(3);

      const count = await notificationService.markAllAsRead(tenantId, userId, branchId);
      expect(count).toBe(3);

      unread = await notificationService.getNotifications(tenantId, userId, 50, { unreadOnly: true });
      expect(unread).toHaveLength(0);
    });
  });

  describe("5. Device Token Lifecycle & Push Provider Integration", () => {
    it("registers active device token and dispatches push", async () => {
      const deviceToken = "fcm_token_device_abc123";
      await notificationService.registerDeviceToken(userId, deviceToken, "ANDROID_MANAGER");

      const activeTokens = notificationService.getActiveDeviceTokens(userId);
      expect(activeTokens).toHaveLength(1);
      expect(activeTokens[0].token).toBe(deviceToken);
      expect(activeTokens[0].active).toBe(true);
      expect(activeTokens[0].platform).toBe("ANDROID_MANAGER");

      // Dispatch notification
      await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "NEW_DELIVERY_ASSIGNMENT",
        priority: "HIGH",
        title: "New Delivery Assigned",
        body: "Delivery #77 assigned to you",
        targetEntity: { type: "DELIVERY", id: "del_77" },
      });

      const pushProvider = notificationService.getProvider<MockPushProvider>("PUSH");
      expect(pushProvider?.sentPush).toHaveLength(1);
      expect(pushProvider?.sentPush[0].recipientContact).toBe(deviceToken);
      expect(pushProvider?.sentPush[0].deepLink).toBe("restaurantos://delivery/del_77");
    });

    it("revoking device token prevents subsequent push dispatches", async () => {
      const deviceToken = "fcm_token_device_to_revoke";
      await notificationService.registerDeviceToken(userId, deviceToken, "ANDROID_DRIVER");

      // Revoke token
      const revoked = await notificationService.revokeDeviceToken(deviceToken);
      expect(revoked).toBe(true);

      const activeTokens = notificationService.getActiveDeviceTokens(userId);
      expect(activeTokens).toHaveLength(0);

      // Dispatch notification
      await notificationService.dispatchActionableNotification({
        tenantId,
        branchId,
        recipientId: userId,
        type: "MANAGER_MESSAGE",
        priority: "MEDIUM",
        title: "Driver Note",
        body: "Take break after this run",
        targetEntity: { type: "ALERT", id: "alt_break" },
      });

      const pushProvider = notificationService.getProvider<MockPushProvider>("PUSH");
      expect(pushProvider?.sentPush).toHaveLength(0);
    });
  });
});
