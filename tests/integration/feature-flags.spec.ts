import { describe, it, expect, beforeEach } from "vitest";
import { featureFlagService } from "@/modules/feature-flags/feature-flag-service";
import { memoryDb } from "@/core/database/db";

describe("Hierarchical Feature Flags Engine", () => {
  beforeEach(() => {
    memoryDb.reset();
  });

  it("should evaluate flags in hierarchical order: Branch > Restaurant > Tenant > Env > Default", async () => {
    const flagKey = "ai_smart_routing";
    const tenantId = crypto.randomUUID();
    const restId = crypto.randomUUID();
    const branch1Id = crypto.randomUUID();
    const branch2Id = crypto.randomUUID();

    // 1. Initial State: Global default is false
    const defaultVal = await featureFlagService.isEnabled(flagKey);
    expect(defaultVal).toBe(false);

    // 2. Enable for Tenant
    await featureFlagService.setFlag({
      key: flagKey,
      tenantId,
      enabled: true,
    });

    // Tenant should now be enabled
    expect(await featureFlagService.isEnabled(flagKey, { tenantId })).toBe(true);

    // Unrelated tenant should remain false
    expect(await featureFlagService.isEnabled(flagKey, { tenantId: crypto.randomUUID() })).toBe(false);

    // 3. Disable at Branch 1 level (override tenant)
    await featureFlagService.setFlag({
      key: flagKey,
      tenantId,
      restaurantId: restId,
      branchId: branch1Id,
      enabled: false,
    });

    // Branch 1 is false (override)
    expect(
      await featureFlagService.isEnabled(flagKey, {
        tenantId,
        restaurantId: restId,
        branchId: branch1Id,
      })
    ).toBe(false);

    // Branch 2 inherits tenant's true setting
    expect(
      await featureFlagService.isEnabled(flagKey, {
        tenantId,
        restaurantId: restId,
        branchId: branch2Id,
      })
    ).toBe(true);
  });
});
