/**
 * Canonical Realtime Communication Contracts & Event Envelopes
 *
 * Implements the Two-Step Ephemeral Ticket Handshake (DOC-SEC-ARCH-001)
 * and Snapshot + Event Resynchronization model.
 */

export type RealtimeConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "AUTHENTICATING"
  | "SUBSCRIBING"
  | "SNAPSHOT_SYNCING"
  | "CONNECTED"
  | "RECONNECTING";

export interface RealtimeTicketRequest {
  branchId: string;
  stationId?: string;
  channel?: string;
}

export interface RealtimeTicketResponse {
  ticket: string;
  expiresAt: string; // ISO 8601 (60s TTL)
  authorizedChannels: string[];
}

export interface RealtimeEvent<T = any> {
  eventId: string;
  eventType: string;
  timestamp: string; // ISO 8601
  aggregateId: string;
  tenantId: string;
  branchId?: string;
  channel: string;
  sequence?: number;
  payload: T;
}

export interface RealtimeSnapshot<T = any> {
  channel: string;
  snapshotId: string;
  serverTimestamp: string;
  sequence?: number;
  data: T;
}

/**
 * Standard Channel Patterns (DOC-SEC-ARCH-001)
 */
export const REALTIME_CHANNELS = {
  kdsStation: (branchId: string, stationId: string) => `branch:${branchId}:kds:${stationId}`,
  kdsAll: (branchId: string) => `branch:${branchId}:kds:all`,
  dispatch: (branchId: string) => `branch:${branchId}:dispatch`,
  driverDeliveries: (driverId: string) => `driver:${driverId}:deliveries`,
  driverBranch: (branchId: string) => `branch:${branchId}:driver:me`,
  orderTracking: (orderId: string) => `order:${orderId}:tracking`,
  telemetry: (branchId: string) => `branch:${branchId}:telemetry`,
  admin: (branchId: string) => `branch:${branchId}:admin`,
} as const;

export type RealtimeChannelBuilder = typeof REALTIME_CHANNELS;
