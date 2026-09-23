/**
 * Canonical Deep Linking Contracts & Route Targets
 *
 * Implements Prompt 17: Unified Notifications, Push Delivery and Deep Linking.
 * Canonical URI format: restaurantos://{entity}/{id}
 */

import { TargetEntityType } from "./notifications";

export const DEEP_LINK_SCHEME = "restaurantos";

export type DeepLinkEntity =
  | "delivery"
  | "order"
  | "kds/ticket"
  | "driver"
  | "alert";

export interface ParsedDeepLink {
  rawUri: string;
  scheme: string;
  entity: string;
  targetEntityType: TargetEntityType;
  targetId: string;
  subPath?: string;
  queryParams?: Record<string, string>;
}

export interface WebRouteResolution {
  path: string;
  searchParams: Record<string, string>;
  fullUrl: string;
}

export interface ManagerAppRouteResolution {
  tab: "dashboard" | "orders" | "deliveries" | "drivers" | "kds" | "customers" | "notifications" | "settings";
  entityId?: string;
  action?: string;
}

export interface DriverAppRouteResolution {
  screen: "home" | "shift" | "queue" | "delivery" | "notifications" | "settings";
  deliveryId?: string;
  action?: string;
}

export interface KDSRouteResolution {
  branchId?: string;
  ticketId?: string;
  stationId?: string;
}

export interface DeepLinkResolution {
  parsed: ParsedDeepLink;
  web: WebRouteResolution;
  managerApp: ManagerAppRouteResolution;
  driverApp: DriverAppRouteResolution;
  kds: KDSRouteResolution;
}
