export type Role =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "KITCHEN_MANAGER"
  | "KITCHEN_EMPLOYEE"
  | "CASHIER"
  | "DELIVERY_MANAGER"
  | "DRIVER"
  | "INVENTORY_MANAGER"
  | "MARKETING_MANAGER"
  | "ACCOUNTANT"
  | "VIEWER";

export const ALL_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "KITCHEN_MANAGER",
  "KITCHEN_EMPLOYEE",
  "CASHIER",
  "DELIVERY_MANAGER",
  "DRIVER",
  "INVENTORY_MANAGER",
  "MARKETING_MANAGER",
  "ACCOUNTANT",
  "VIEWER",
];

export type Permission =
  // Tenant & System
  | "organizations.manage"
  | "organizations.read"
  | "restaurants.manage"
  | "restaurants.read"
  | "branches.manage"
  | "branches.read"
  | "users.manage"
  | "users.read"
  | "settings.manage"
  // Orders & Cashier
  | "orders.create"
  | "orders.read"
  | "orders.update"
  | "orders.cancel"
  | "orders.refund"
  // Kitchen (KDS)
  | "kds.view"
  | "kds.bump"
  | "kds.recall"
  // Delivery & Dispatch
  | "delivery.read"
  | "delivery.assign"
  | "delivery.batch"
  | "delivery.status_update"
  | "delivery.override"
  | "fleet.track"
  | "fleet.manage"
  // Inventory & Menu
  | "inventory.read"
  | "inventory.manage"
  | "inventory.adjust"
  | "menu.read"
  | "menu.manage"
  // Marketing & Reports
  | "campaigns.manage"
  | "campaigns.read"
  | "reports.read"
  | "reports.export"
  | "audit.read";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "organizations.manage",
    "organizations.read",
    "restaurants.manage",
    "restaurants.read",
    "branches.manage",
    "branches.read",
    "users.manage",
    "users.read",
    "settings.manage",
    "orders.create",
    "orders.read",
    "orders.update",
    "orders.cancel",
    "orders.refund",
    "kds.view",
    "kds.bump",
    "kds.recall",
    "delivery.read",
    "delivery.assign",
    "delivery.batch",
    "delivery.status_update",
    "delivery.override",
    "fleet.track",
    "fleet.manage",
    "inventory.read",
    "inventory.manage",
    "inventory.adjust",
    "menu.read",
    "menu.manage",
    "campaigns.manage",
    "campaigns.read",
    "reports.read",
    "reports.export",
    "audit.read",
  ],
  ADMIN: [
    "organizations.read",
    "restaurants.manage",
    "restaurants.read",
    "branches.manage",
    "branches.read",
    "users.manage",
    "users.read",
    "settings.manage",
    "orders.create",
    "orders.read",
    "orders.update",
    "orders.cancel",
    "orders.refund",
    "kds.view",
    "kds.bump",
    "kds.recall",
    "delivery.read",
    "delivery.assign",
    "delivery.batch",
    "delivery.status_update",
    "delivery.override",
    "fleet.track",
    "fleet.manage",
    "inventory.read",
    "inventory.manage",
    "inventory.adjust",
    "menu.read",
    "menu.manage",
    "campaigns.manage",
    "campaigns.read",
    "reports.read",
    "reports.export",
    "audit.read",
  ],
  MANAGER: [
    "branches.read",
    "users.read",
    "orders.create",
    "orders.read",
    "orders.update",
    "orders.cancel",
    "orders.refund",
    "kds.view",
    "kds.bump",
    "kds.recall",
    "delivery.read",
    "delivery.assign",
    "delivery.batch",
    "delivery.status_update",
    "delivery.override",
    "fleet.track",
    "inventory.read",
    "inventory.adjust",
    "menu.read",
    "reports.read",
  ],
  KITCHEN_MANAGER: [
    "orders.read",
    "kds.view",
    "kds.bump",
    "kds.recall",
    "inventory.read",
    "inventory.adjust",
  ],
  KITCHEN_EMPLOYEE: [
    "orders.read",
    "kds.view",
    "kds.bump",
  ],
  CASHIER: [
    "orders.create",
    "orders.read",
    "orders.update",
    "menu.read",
  ],
  DELIVERY_MANAGER: [
    "orders.read",
    "delivery.read",
    "delivery.assign",
    "delivery.batch",
    "delivery.status_update",
    "delivery.override",
    "fleet.track",
    "fleet.manage",
  ],
  DRIVER: [
    "delivery.read",
    "delivery.status_update",
  ],
  INVENTORY_MANAGER: [
    "inventory.read",
    "inventory.manage",
    "inventory.adjust",
    "menu.read",
    "menu.manage",
  ],
  MARKETING_MANAGER: [
    "campaigns.manage",
    "campaigns.read",
    "reports.read",
  ],
  ACCOUNTANT: [
    "orders.read",
    "reports.read",
    "reports.export",
    "audit.read",
  ],
  VIEWER: [
    "orders.read",
    "reports.read",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}
