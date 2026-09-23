/**
 * Canonical Notification Contracts & Envelopes
 *
 * Implements Prompt 17: Unified Notifications, Push Delivery and Deep Linking.
 * Represents actionable, typed notification events across all client platforms.
 */

export type NotificationType =
  | "NEW_DELIVERY_ASSIGNMENT"
  | "DELIVERY_REASSIGNMENT"
  | "DELIVERY_OVERDUE"
  | "NO_AVAILABLE_DRIVER"
  | "KDS_SLA_BREACH"
  | "ORDER_ISSUE"
  | "PAYMENT_ISSUE"
  | "INTEGRATION_FAILURE"
  | "SYSTEM_ALERT"
  | "MANAGER_MESSAGE";

export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TargetEntityType =
  | "ORDER"
  | "DELIVERY"
  | "KDS_TICKET"
  | "DRIVER"
  | "ALERT"
  | "INTEGRATION";

export type ClientPlatform =
  | "WEB"
  | "ANDROID_MANAGER"
  | "ANDROID_DRIVER"
  | "KDS_STATION"
  | "IOS";

export type NotificationChannel = "IN_APP" | "PUSH" | "EMAIL" | "SMS" | "WHATSAPP";

export interface TargetEntityReference {
  type: TargetEntityType;
  id: string;
}

export interface NotificationEnvelope {
  id: string;
  tenantId: string;
  branchId: string;
  recipientId: string; // Specific User ID / Driver ID or recipient role group (e.g., 'ROLE:MANAGER', 'ROLE:KITCHEN_STAFF')
  type: NotificationType;
  priority: NotificationPriority;
  timestamp: string; // ISO 8601
  title: string;
  body: string;
  targetEntity: TargetEntityReference;
  deepLink: string; // Canonical URI: restaurantos://...
  read: boolean;
  readAt?: string;
  expiresAt?: string;
  deduplicationKey?: string;
  data?: Record<string, any>; // Strictly sanitized, non-sensitive contextual metadata
}

export interface PushDeviceRegistration {
  userId: string;
  token: string;
  platform: ClientPlatform;
  active: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface NotificationFilterParams {
  tenantId: string;
  recipientId?: string;
  branchId?: string;
  unreadOnly?: boolean;
  type?: NotificationType;
  priority?: NotificationPriority;
  limit?: number;
}
