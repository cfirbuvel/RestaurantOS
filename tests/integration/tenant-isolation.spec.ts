import { describe, it, expect, beforeEach } from "vitest";
import { organizationService } from "@/modules/identity/domain/organization";
import { branchService } from "@/modules/identity/domain/branch";
import { memoryDb, withTenantContext } from "@/core/database/db";
import { auditLogger, sanitizeAuditData } from "@/core/audit/audit-logger";

describe("Multi-Tenancy Isolation & Security Boundaries", () => {
  beforeEach(() => {
    memoryDb.reset();
  });

  it("should prevent Tenant B from reading Tenant A branches", async () => {
    // Setup Tenant A
    const orgA = await organizationService.createOrganization({
      name: "Tenant Alpha",
      slug: "tenant-alpha",
    });
    const restA = await branchService.createRestaurant({
      organizationId: orgA.id,
      name: "Alpha Grill",
      slug: "alpha-grill",
    });
    const branchA = await branchService.createBranch({
      organizationId: orgA.id,
      restaurantId: restA.id,
      name: "Alpha Main",
      slug: "alpha-main",
    });

    // Setup Tenant B
    const orgB = await organizationService.createOrganization({
      name: "Tenant Beta",
      slug: "tenant-beta",
    });

    // Tenant A queries Branch A -> Success
    const foundByA = await branchService.findBranchById(orgA.id, branchA.id);
    expect(foundByA).not.toBeNull();
    expect(foundByA?.name).toBe("Alpha Main");

    // Tenant B queries Branch A -> Blocked / Returns null
    const foundByB = await branchService.findBranchById(orgB.id, branchA.id);
    expect(foundByB).toBeNull();
  });

  it("withTenantContext should restrict query visibility to current tenant", async () => {
    const org1 = await organizationService.createOrganization({
      name: "Org 1",
      slug: "org-1",
    });
    const org2 = await organizationService.createOrganization({
      name: "Org 2",
      slug: "org-2",
    });

    memoryDb.insert("restaurants", {
      organization_id: org1.id,
      name: "Org 1 Diner",
      slug: "diner-1",
    });

    memoryDb.insert("restaurants", {
      organization_id: org2.id,
      name: "Org 2 Pizzeria",
      slug: "pizza-2",
    });

    // In context of Org 1
    await withTenantContext({ organizationId: org1.id }, async ({ memory }) => {
      const results = memory.find("restaurants", () => true);
      expect(results).toHaveLength(1);
      expect(results[0].organization_id).toBe(org1.id);
      expect(results[0].name).toBe("Org 1 Diner");
    });

    // In context of Org 2
    await withTenantContext({ organizationId: org2.id }, async ({ memory }) => {
      const results = memory.find("restaurants", () => true);
      expect(results).toHaveLength(1);
      expect(results[0].organization_id).toBe(org2.id);
      expect(results[0].name).toBe("Org 2 Pizzeria");
    });
  });

  it("should sanitize and redact secrets in audit logging", async () => {
    const rawData = {
      email: "chef@restaurant.co.il",
      password: "PlainTextPassword123!",
      password_hash: "$2a$10$abcdefghijklmnopqrstuvwxyz",
      pin: "4321",
      token: "secret_session_token",
      nested: {
        api_key: "ak_live_9999",
        restaurantName: "Cafe Central",
      },
    };

    const sanitized = sanitizeAuditData(rawData);

    expect(sanitized.email).toBe("chef@restaurant.co.il");
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.password_hash).toBe("[REDACTED]");
    expect(sanitized.pin).toBe("[REDACTED]");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.nested.api_key).toBe("[REDACTED]");
    expect(sanitized.nested.restaurantName).toBe("Cafe Central");

    // Write audit log with sensitive data
    const logged = await auditLogger.log({
      actor: { actorId: "actor_1", actorType: "USER" },
      action: "UPDATE_PROFILE",
      entity: "User",
      entityId: "user_1",
      newState: rawData,
    });

    expect(logged.new_state.password).toBe("[REDACTED]");
    expect(logged.new_state.pin).toBe("[REDACTED]");
  });
});
