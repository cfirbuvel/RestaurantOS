/**
 * Canonical Authentication & Principal Contracts
 */

import { Role, Permission } from "@/modules/identity/domain/rbac";

export type { Role, Permission };

export interface AuthPrincipal {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: Permission[];
  organizationId: string;
  branchId?: string;
  stationId?: string;
  deviceId?: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken?: string;
  tokenType: "Bearer";
  expiresIn: number; // in seconds
  expiresAt: string; // ISO 8601
}

export interface AuthSessionResponse {
  token: string;
  refreshToken?: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    organizationId: string;
    branchId?: string;
  };
}

export interface PasswordLoginPayload {
  email: string;
  password: string;
  deviceId?: string;
}

export interface PinLoginPayload {
  branchId: string;
  pin: string;
  deviceId?: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface DevicePairingPayload {
  activationCode: string;
  deviceType: "KDS" | "KIOSK" | "MANAGER_TERMINAL";
  branchId: string;
  stationId?: string;
  deviceName: string;
}

export interface DevicePairingResponse {
  deviceToken: string;
  deviceId: string;
  branchId: string;
  stationId?: string;
  tenantId: string;
}
