import crypto from "crypto";
import {
  NotificationEnvelope,
  NotificationType,
  NotificationPriority,
  NotificationFilterParams,
  PushDeviceRegistration,
  ClientPlatform,
  TargetEntityType,
} from "@/shared/contracts/notifications";
import { DeepLinkResolver } from "@/shared/deep-linking/deep-link-resolver";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";

export interface NotificationPayload {
  tenantId: string;
  restaurantId?: string;
  branchId?: string;
  recipientId: string;
  recipientContact?: string; // email, phone number, device token
  title: string;
  body: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  targetEntity?: {
    type: TargetEntityType;
    id: string;
  };
  deepLink?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  expiresAt?: string;
  deduplicationKey?: string;
}

export interface NotificationDispatchResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationProvider {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<NotificationDispatchResult>;
}

export class MockEmailProvider implements NotificationProvider {
  channel: NotificationChannel = "EMAIL";
  public sentEmails: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentEmails.push(payload);
    return {
      channel: "EMAIL",
      success: true,
      messageId: `mock_email_${crypto.randomUUID()}`,
    };
  }
}

export class MockSMSProvider implements NotificationProvider {
  channel: NotificationChannel = "SMS";
  public sentSMS: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentSMS.push(payload);
    return {
      channel: "SMS",
      success: true,
      messageId: `mock_sms_${crypto.randomUUID()}`,
    };
  }
}

export class MockWhatsAppProvider implements NotificationProvider {
  channel: NotificationChannel = "WHATSAPP";
  public sentWhatsApp: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentWhatsApp.push(payload);
    return {
      channel: "WHATSAPP",
      success: true,
      messageId: `mock_wa_${crypto.randomUUID()}`,
    };
  }
}

export class MockPushProvider implements NotificationProvider {
  channel: NotificationChannel = "PUSH";
  public sentPush: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentPush.push(payload);
    return {
      channel: "PUSH",
      success: true,
      messageId: `mock_push_${crypto.randomUUID()}`,
    };
  }
}

export class NotificationService {
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();
  public inAppNotifications: Array<NotificationEnvelope & { createdAt: Date }> = [];
  private deviceTokens: Map<string, PushDeviceRegistration> = new Map();

  // Deduplication cache: deduplicationKey -> timestamp
  private deduplicationCache: Map<string, number> = new Map();
  private deduplicationWindowMs: number = 5 * 60 * 1000; // 5 minutes sliding window

  constructor() {
    this.registerProvider(new MockEmailProvider());
    this.registerProvider(new MockSMSProvider());
    this.registerProvider(new MockWhatsAppProvider());
    this.registerProvider(new MockPushProvider());
  }

  registerProvider(provider: NotificationProvider) {
    this.providers.set(provider.channel, provider);
  }

  getProvider<T extends NotificationProvider>(channel: NotificationChannel): T | undefined {
    return this.providers.get(channel) as T;
  }

  /**
   * Register a client device token for push notifications
   */
  async registerDeviceToken(userId: string, token: string, platform: string = "ANDROID_MANAGER"): Promise<void> {
    if (!token || !userId) {
      throw new Error("Missing token or userId for device token registration");
    }

    const now = new Date().toISOString();
    const existing = this.deviceTokens.get(token);

    this.deviceTokens.set(token, {
      userId,
      token,
      platform: (platform.toUpperCase() as ClientPlatform) || "ANDROID_MANAGER",
      active: true,
      updatedAt: now,
      createdAt: existing ? existing.createdAt : now,
    });
  }

  /**
   * Revoke/deactivate a device token (e.g. upon logout or app uninstall)
   */
  async revokeDeviceToken(token: string): Promise<boolean> {
    const registration = this.deviceTokens.get(token);
    if (!registration) return false;

    registration.active = false;
    registration.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Retrieve active device tokens for a user
   */
  getActiveDeviceTokens(userId: string): PushDeviceRegistration[] {
    return Array.from(this.deviceTokens.values()).filter(
      (reg) => reg.userId === userId && reg.active
    );
  }

  /**
   * Check and record deduplication key. Returns true if duplicate (should be suppressed).
   */
  public isDuplicate(deduplicationKey?: string): boolean {
    if (!deduplicationKey) return false;

    const now = Date.now();
    const lastSeen = this.deduplicationCache.get(deduplicationKey);

    if (lastSeen && now - lastSeen < this.deduplicationWindowMs) {
      return true;
    }

    this.deduplicationCache.set(deduplicationKey, now);

    // Prune stale cache entries
    if (this.deduplicationCache.size > 2000) {
      for (const [k, timestamp] of this.deduplicationCache.entries()) {
        if (now - timestamp > this.deduplicationWindowMs) {
          this.deduplicationCache.delete(k);
        }
      }
    }

    return false;
  }

  /**
   * Dispatch an actionable typed notification across in-app and push channels
   * Implements deduplication, expiration, and deep link enforcement.
   */
  async dispatchActionableNotification(
    input: Omit<NotificationEnvelope, "id" | "timestamp" | "read" | "deepLink"> & {
      id?: string;
      deepLink?: string;
      channels?: NotificationChannel[];
    }
  ): Promise<NotificationEnvelope | null> {
    // 1. Deduplication check
    if (input.deduplicationKey && this.isDuplicate(input.deduplicationKey)) {
      return null;
    }

    const now = new Date();
    const id = input.id || `notif_${crypto.randomUUID()}`;
    const timestamp = now.toISOString();

    // 2. Ensure canonical deep link
    let deepLink = input.deepLink;
    if (!deepLink && input.targetEntity) {
      const entityMap: Record<TargetEntityType, "delivery" | "order" | "kds/ticket" | "driver" | "alert"> = {
        DELIVERY: "delivery",
        ORDER: "order",
        KDS_TICKET: "kds/ticket",
        DRIVER: "driver",
        ALERT: "alert",
        INTEGRATION: "alert",
      };
      const entitySegment = entityMap[input.targetEntity.type];
      deepLink = DeepLinkResolver.buildUri(entitySegment, input.targetEntity.id);
    }

    // 3. Construct canonical envelope
    const envelope: NotificationEnvelope = {
      id,
      tenantId: input.tenantId,
      branchId: input.branchId,
      recipientId: input.recipientId,
      type: input.type,
      priority: input.priority,
      timestamp,
      title: input.title,
      body: input.body,
      targetEntity: input.targetEntity,
      deepLink: deepLink || `restaurantos://alert/${id}`,
      read: false,
      expiresAt: input.expiresAt,
      deduplicationKey: input.deduplicationKey,
      data: input.data,
    };

    // 4. Store in-app
    this.inAppNotifications.push({
      ...envelope,
      createdAt: now,
    });

    // 5. Dispatch PUSH to active device tokens for the recipient (if recipient is specific user)
    const activeTokens = this.getActiveDeviceTokens(input.recipientId);
    if (activeTokens.length > 0) {
      const pushProvider = this.getProvider<MockPushProvider>("PUSH");
      if (pushProvider) {
        for (const dev of activeTokens) {
          await pushProvider.send({
            tenantId: envelope.tenantId,
            branchId: envelope.branchId,
            recipientId: envelope.recipientId,
            recipientContact: dev.token,
            title: envelope.title,
            body: envelope.body,
            channels: ["PUSH"],
            targetEntity: envelope.targetEntity,
            deepLink: envelope.deepLink,
            type: envelope.type,
            priority: envelope.priority,
            data: envelope.data,
          });
        }
      }
    }

    return envelope;
  }

  /**
   * Send notification through explicit channels (backwards compatibility)
   */
  async send(payload: NotificationPayload): Promise<NotificationDispatchResult[]> {
    if (payload.deduplicationKey && this.isDuplicate(payload.deduplicationKey)) {
      return [{
        channel: "IN_APP",
        success: true,
        messageId: "deduplicated_suppressed",
      }];
    }

    const results: NotificationDispatchResult[] = [];
    const now = new Date();

    for (const channel of payload.channels) {
      if (channel === "IN_APP") {
        const id = crypto.randomUUID();
        const envelope: NotificationEnvelope = {
          id,
          tenantId: payload.tenantId,
          branchId: payload.branchId || "default",
          recipientId: payload.recipientId,
          type: payload.type || "SYSTEM_ALERT",
          priority: payload.priority || "MEDIUM",
          timestamp: now.toISOString(),
          title: payload.title,
          body: payload.body,
          targetEntity: payload.targetEntity || { type: "ALERT", id },
          deepLink: payload.deepLink || `restaurantos://alert/${id}`,
          read: false,
          expiresAt: payload.expiresAt,
          deduplicationKey: payload.deduplicationKey,
          data: payload.data,
        };

        this.inAppNotifications.push({
          ...envelope,
          createdAt: now,
        });

        results.push({
          channel: "IN_APP",
          success: true,
          messageId: `inapp_${id}`,
        });
        continue;
      }

      const provider = this.providers.get(channel);
      if (!provider) {
        results.push({
          channel,
          success: false,
          error: `No provider registered for channel ${channel}`,
        });
        continue;
      }

      try {
        const res = await provider.send(payload);
        results.push(res);
      } catch (err: any) {
        results.push({
          channel,
          success: false,
          error: err?.message || "Provider dispatch failed",
        });
      }
    }

    return results;
  }

  /**
   * Retrieve filtered, unexpired notifications for a user/tenant/branch
   */
  async getNotifications(
    tenantId: string,
    recipientId: string,
    limit: number = 50,
    filters?: Omit<NotificationFilterParams, "tenantId" | "recipientId" | "limit">
  ): Promise<NotificationEnvelope[]> {
    const now = Date.now();

    return this.inAppNotifications
      .filter((n) => {
        // Tenant boundary
        if (n.tenantId !== tenantId) return false;

        // Recipient boundary: exact match, broadcast, or role matching
        const recipientMatches =
          n.recipientId === recipientId ||
          n.recipientId === "ALL_STAFF" ||
          n.recipientId === "MANAGERS" ||
          (n.recipientId.startsWith("ROLE:") && recipientId.includes(n.recipientId.replace("ROLE:", "")));

        if (!recipientMatches) return false;

        // Branch filter if specified
        if (filters?.branchId && n.branchId && n.branchId !== filters.branchId && n.branchId !== "default") {
          return false;
        }

        // Unread only filter
        if (filters?.unreadOnly && n.read) {
          return false;
        }

        // Type filter
        if (filters?.type && n.type !== filters.type) {
          return false;
        }

        // Priority filter
        if (filters?.priority && n.priority !== filters.priority) {
          return false;
        }

        // Expiration check: filter out stale notifications
        if (n.expiresAt && new Date(n.expiresAt).getTime() < now) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(({ createdAt, ...envelope }) => envelope);
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, tenantId?: string, userId?: string): Promise<boolean> {
    const notif = this.inAppNotifications.find((n) => {
      if (n.id !== notificationId) return false;
      if (tenantId && n.tenantId !== tenantId) return false;
      if (userId && n.recipientId !== userId && n.recipientId !== "ALL_STAFF" && n.recipientId !== "MANAGERS" && !n.recipientId.startsWith("ROLE:")) {
        return false;
      }
      return true;
    });

    if (notif) {
      notif.read = true;
      notif.readAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read for a given user and tenant
   */
  async markAllAsRead(tenantId: string, recipientId: string, branchId?: string): Promise<number> {
    let count = 0;
    const nowIso = new Date().toISOString();

    for (const notif of this.inAppNotifications) {
      if (notif.tenantId !== tenantId) continue;
      if (branchId && notif.branchId && notif.branchId !== branchId && notif.branchId !== "default") continue;

      const recipientMatches =
        notif.recipientId === recipientId ||
        notif.recipientId === "ALL_STAFF" ||
        notif.recipientId === "MANAGERS" ||
        (notif.recipientId.startsWith("ROLE:") && recipientId.includes(notif.recipientId.replace("ROLE:", "")));

      if (recipientMatches && !notif.read) {
        notif.read = true;
        notif.readAt = nowIso;
        count++;
      }
    }

    return count;
  }

  /**
   * Clear in-memory notification state (used for testing)
   */
  clear(): void {
    this.inAppNotifications = [];
    this.deviceTokens.clear();
    this.deduplicationCache.clear();
    const push = this.getProvider<MockPushProvider>("PUSH");
    if (push) push.sentPush = [];
    const email = this.getProvider<MockEmailProvider>("EMAIL");
    if (email) email.sentEmails = [];
    const sms = this.getProvider<MockSMSProvider>("SMS");
    if (sms) sms.sentSMS = [];
  }
}

export const notificationService = new NotificationService();
