import { describe, it, expect } from "vitest";
import {
  ALL_ROLES,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  Role,
} from "@/modules/identity/domain/rbac";

describe("RBAC Subsystem (12 Roles & Granular Permissions)", () => {
  it("should contain exactly 12 canonical roles", () => {
    expect(ALL_ROLES).toHaveLength(12);
    expect(ALL_ROLES).toContain("OWNER");
    expect(ALL_ROLES).toContain("ADMIN");
    expect(ALL_ROLES).toContain("MANAGER");
    expect(ALL_ROLES).toContain("KITCHEN_MANAGER");
    expect(ALL_ROLES).toContain("KITCHEN_EMPLOYEE");
    expect(ALL_ROLES).toContain("CASHIER");
    expect(ALL_ROLES).toContain("DELIVERY_MANAGER");
    expect(ALL_ROLES).toContain("DRIVER");
    expect(ALL_ROLES).toContain("INVENTORY_MANAGER");
    expect(ALL_ROLES).toContain("MARKETING_MANAGER");
    expect(ALL_ROLES).toContain("ACCOUNTANT");
    expect(ALL_ROLES).toContain("VIEWER");
  });

  it("OWNER should possess full administrative permissions", () => {
    expect(hasPermission("OWNER", "organizations.manage")).toBe(true);
    expect(hasPermission("OWNER", "orders.refund")).toBe(true);
    expect(hasPermission("OWNER", "settings.manage")).toBe(true);
    expect(hasPermission("OWNER", "audit.read")).toBe(true);
  });

  it("DRIVER should only possess delivery permissions and cannot refund or manage menu", () => {
    expect(hasPermission("DRIVER", "delivery.read")).toBe(true);
    expect(hasPermission("DRIVER", "delivery.status_update")).toBe(true);

    expect(hasPermission("DRIVER", "orders.create")).toBe(false);
    expect(hasPermission("DRIVER", "orders.refund")).toBe(false);
    expect(hasPermission("DRIVER", "menu.manage")).toBe(false);
    expect(hasPermission("DRIVER", "organizations.manage")).toBe(false);
  });

  it("CASHIER can create orders and read menu, but cannot manage fleet or inventory", () => {
    expect(hasPermission("CASHIER", "orders.create")).toBe(true);
    expect(hasPermission("CASHIER", "menu.read")).toBe(true);

    expect(hasPermission("CASHIER", "fleet.manage")).toBe(false);
    expect(hasPermission("CASHIER", "inventory.manage")).toBe(false);
    expect(hasPermission("CASHIER", "kds.recall")).toBe(false);
  });

  it("KITCHEN_EMPLOYEE can view and bump KDS tickets", () => {
    expect(hasPermission("KITCHEN_EMPLOYEE", "kds.view")).toBe(true);
    expect(hasPermission("KITCHEN_EMPLOYEE", "kds.bump")).toBe(true);

    // Cannot recall tickets or modify campaigns
    expect(hasPermission("KITCHEN_EMPLOYEE", "kds.recall")).toBe(false);
    expect(hasPermission("KITCHEN_EMPLOYEE", "campaigns.manage")).toBe(false);
  });

  it("hasAnyPermission and hasAllPermissions helpers evaluate accurately", () => {
    expect(hasAnyPermission("CASHIER", ["orders.create", "fleet.track"])).toBe(true);
    expect(hasAnyPermission("DRIVER", ["orders.create", "fleet.manage"])).toBe(false);

    expect(hasAllPermissions("OWNER", ["orders.create", "orders.refund"])).toBe(true);
    expect(hasAllPermissions("MANAGER", ["orders.create", "organizations.manage"])).toBe(false);
  });
});
