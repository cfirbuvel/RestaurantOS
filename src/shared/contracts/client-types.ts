/**
 * Canonical Client Identification & Context Contracts
 *
 * NOTE ON SECURITY:
 * X-Client-Type is contextual telemetry metadata. It MUST NEVER be used as a
 * security boundary or proof of authorization. Authorization is derived strictly
 * from server-side authenticated sessions, tokens, RBAC roles, and tenant/branch scopes.
 */

export type ClientType =
  | "WEB_ADMIN"
  | "MANAGER_APP"
  | "DRIVER_APP"
  | "KDS_UI"
  | "KIOSK"
  | "CUSTOMER_WEB";

export const CLIENT_TYPES: Record<ClientType, ClientType> = {
  WEB_ADMIN: "WEB_ADMIN",
  MANAGER_APP: "MANAGER_APP",
  DRIVER_APP: "DRIVER_APP",
  KDS_UI: "KDS_UI",
  KIOSK: "KIOSK",
  CUSTOMER_WEB: "CUSTOMER_WEB",
};

export const CLIENT_HEADERS = {
  CLIENT_TYPE: "x-client-type",
  TENANT_ID: "x-tenant-id",
  BRANCH_ID: "x-branch-id",
  REQUEST_ID: "x-request-id",
  IDEMPOTENCY_KEY: "idempotency-key",
  DEVICE_ID: "x-device-id",
  CLIENT_VERSION: "x-client-version",
} as const;

export interface ClientContext {
  clientType: ClientType;
  tenantId?: string;
  branchId?: string;
  deviceId?: string;
  clientVersion?: string;
}
