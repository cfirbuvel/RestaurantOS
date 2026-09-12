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
  // Tenant & Organization
  | "organizations.manage"
  | "organizations.read"
  | "restaurants.manage"
  | "restaurants.read"
  | "branches.manage"
  | "branches.read"
  | "settings.manage"
  | "billing.read"
  | "billing.manage"
  // Users & Staff
  | "users.manage"
  | "users.read"
  | "employees.manage"
  | "employees.read"
  // Tables & Seating
  | "tables.manage"
  | "tables.read"
  // Orders & Payments
  | "orders.create"
  | "orders.read"
  | "orders.update"
  | "orders.cancel"
  | "orders.refund"
  | "payments.process"
  | "payments.refund"
  // Kitchen (KDS)
  | "kds.view"
  | "kds.bump"
  | "kds.recall"
  // Delivery & Logistics
  | "delivery.read"
  | "delivery.assign"
  | "delivery.batch"
  | "delivery.status_update"
  | "delivery.override"
  // Fleet & Telematics
  | "fleet.track"
  | "fleet.manage"
  | "telemetry.read"
  // Menu & Catalog
  | "menu.read"
  | "menu.manage"
  | "products.manage"
  | "categories.manage"
  // Inventory & Supply Chain
  | "inventory.read"
  | "inventory.manage"
  | "inventory.adjust"
  | "recipes.read"
  | "recipes.manage"
  | "waste.track"
  | "suppliers.read"
  | "suppliers.manage"
  | "purchasing.manage"
  // Customers & Loyalty
  | "customers.read"
  | "customers.manage"
  | "loyalty.manage"
  // Marketing & Promotions
  | "campaigns.manage"
  | "campaigns.read"
  | "promotions.manage"
  // Integrations Hub
  | "integrations.manage"
  | "integrations.read"
  // Observability & Auditing
  | "reports.read"
  | "reports.export"
  | "audit.read"
  | "analytics.view";

export const ALL_PERMISSIONS: Permission[] = [
  "organizations.manage",
  "organizations.read",
  "restaurants.manage",
  "restaurants.read",
  "branches.manage",
  "branches.read",
  "settings.manage",
  "billing.read",
  "billing.manage",
  "users.manage",
  "users.read",
  "employees.manage",
  "employees.read",
  "tables.manage",
  "tables.read",
  "orders.create",
  "orders.read",
  "orders.update",
  "orders.cancel",
  "orders.refund",
  "payments.process",
  "payments.refund",
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
  "telemetry.read",
  "menu.read",
  "menu.manage",
  "products.manage",
  "categories.manage",
  "inventory.read",
  "inventory.manage",
  "inventory.adjust",
  "recipes.read",
  "recipes.manage",
  "waste.track",
  "suppliers.read",
  "suppliers.manage",
  "purchasing.manage",
  "customers.read",
  "customers.manage",
  "loyalty.manage",
  "campaigns.manage",
  "campaigns.read",
  "promotions.manage",
  "integrations.manage",
  "integrations.read",
  "reports.read",
  "reports.export",
  "audit.read",
  "analytics.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [...ALL_PERMISSIONS],
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== "organizations.manage" && p !== "billing.manage"),
  MANAGER: [
    "branches.read",
    "users.read",
    "employees.read",
    "tables.manage",
    "tables.read",
    "orders.create",
    "orders.read",
    "orders.update",
    "orders.cancel",
    "orders.refund",
    "payments.process",
    "payments.refund",
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
    "waste.track",
    "recipes.read",
    "menu.read",
    "customers.read",
    "customers.manage",
    "reports.read",
    "analytics.view",
  ],
  KITCHEN_MANAGER: [
    "orders.read",
    "kds.view",
    "kds.bump",
    "kds.recall",
    "recipes.read",
    "inventory.read",
    "inventory.adjust",
    "waste.track",
  ],
  KITCHEN_EMPLOYEE: [
    "orders.read",
    "kds.view",
    "kds.bump",
    "recipes.read",
  ],
  CASHIER: [
    "orders.create",
    "orders.read",
    "orders.update",
    "payments.process",
    "tables.read",
    "menu.read",
    "customers.read",
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
    "telemetry.read",
  ],
  DRIVER: [
    "delivery.read",
    "delivery.status_update",
  ],
  INVENTORY_MANAGER: [
    "inventory.read",
    "inventory.manage",
    "inventory.adjust",
    "waste.track",
    "recipes.read",
    "recipes.manage",
    "suppliers.read",
    "suppliers.manage",
    "purchasing.manage",
    "menu.read",
    "menu.manage",
    "products.manage",
    "categories.manage",
  ],
  MARKETING_MANAGER: [
    "campaigns.manage",
    "campaigns.read",
    "promotions.manage",
    "loyalty.manage",
    "customers.read",
    "reports.read",
    "analytics.view",
  ],
  ACCOUNTANT: [
    "orders.read",
    "payments.process",
    "payments.refund",
    "billing.read",
    "purchasing.manage",
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
