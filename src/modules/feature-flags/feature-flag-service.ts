import { memoryDb, getPostgresPool } from "@/core/database/db";

export interface FeatureFlagScope {
  tenantId?: string;
  restaurantId?: string;
  branchId?: string;
  environment?: string;
}

export interface FeatureFlagRule {
  key: string;
  enabled: boolean;
  tenantId?: string;
  restaurantId?: string;
  branchId?: string;
  environment?: string;
  rules?: Record<string, any>;
}

export class FeatureFlagService {
  private globalDefaults: Map<string, boolean> = new Map([
    ["delivery_auto_dispatch", true],
    ["kds_prep_timer_pulse", true],
    ["order_cancellation_otp", false],
    ["offline_driver_sync", true],
    ["ai_smart_routing", false],
  ]);

  setGlobalDefault(key: string, enabled: boolean) {
    this.globalDefaults.set(key, enabled);
  }

  async setFlag(rule: FeatureFlagRule): Promise<void> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const existing = memoryDb.find(
        "feature_flags",
        (f) =>
          f.key === rule.key &&
          f.organization_id === (rule.tenantId || null) &&
          f.restaurant_id === (rule.restaurantId || null) &&
          f.branch_id === (rule.branchId || null) &&
          f.environment === (rule.environment || null)
      );

      if (existing.length > 0) {
        memoryDb.update("feature_flags", existing[0].id, {
          enabled: rule.enabled,
          rules: rule.rules || {},
        });
      } else {
        memoryDb.insert("feature_flags", {
          key: rule.key,
          organization_id: rule.tenantId || null,
          restaurant_id: rule.restaurantId || null,
          branch_id: rule.branchId || null,
          environment: rule.environment || null,
          enabled: rule.enabled,
          rules: rule.rules || {},
        });
      }
      return;
    }

    const pool = getPostgresPool();
    await pool.query(
      `INSERT INTO feature_flags (key, organization_id, restaurant_id, branch_id, environment, enabled, rules)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key, organization_id, restaurant_id, branch_id, environment)
       DO UPDATE SET enabled = EXCLUDED.enabled, rules = EXCLUDED.rules, updated_at = NOW()`,
      [
        rule.key,
        rule.tenantId || null,
        rule.restaurantId || null,
        rule.branchId || null,
        rule.environment || null,
        rule.enabled,
        JSON.stringify(rule.rules || {}),
      ]
    );
  }

  async isEnabled(key: string, scope?: FeatureFlagScope): Promise<boolean> {
    const env = scope?.environment || process.env.NODE_ENV || "development";

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const allMatches = memoryDb.find("feature_flags", (f) => f.key === key);

      // 1. Branch Level override
      if (scope?.branchId) {
        const branchMatch = allMatches.find((f) => f.branch_id === scope.branchId);
        if (branchMatch !== undefined) return branchMatch.enabled;
      }

      // 2. Restaurant Level override
      if (scope?.restaurantId) {
        const restMatch = allMatches.find(
          (f) => f.restaurant_id === scope.restaurantId && !f.branch_id
        );
        if (restMatch !== undefined) return restMatch.enabled;
      }

      // 3. Tenant / Organization Level override
      if (scope?.tenantId) {
        const tenantMatch = allMatches.find(
          (f) => f.organization_id === scope.tenantId && !f.restaurant_id && !f.branch_id
        );
        if (tenantMatch !== undefined) return tenantMatch.enabled;
      }

      // 4. Environment Level override
      const envMatch = allMatches.find(
        (f) => f.environment === env && !f.organization_id && !f.restaurant_id && !f.branch_id
      );
      if (envMatch !== undefined) return envMatch.enabled;

      // 5. Default fallback
      return this.globalDefaults.get(key) ?? false;
    }

    const pool = getPostgresPool();
    const query = `
      SELECT enabled, branch_id, restaurant_id, organization_id, environment
      FROM feature_flags
      WHERE key = $1
      AND (
        (branch_id = $2)
        OR (restaurant_id = $3 AND branch_id IS NULL)
        OR (organization_id = $4 AND restaurant_id IS NULL AND branch_id IS NULL)
        OR (environment = $5 AND organization_id IS NULL AND restaurant_id IS NULL AND branch_id IS NULL)
      )
    `;
    const { rows } = await pool.query(query, [
      key,
      scope?.branchId || null,
      scope?.restaurantId || null,
      scope?.tenantId || null,
      env,
    ]);

    if (rows.length === 0) {
      return this.globalDefaults.get(key) ?? false;
    }

    // Rank highest specificity
    const branchRow = rows.find((r) => r.branch_id === scope?.branchId);
    if (branchRow) return branchRow.enabled;

    const restRow = rows.find((r) => r.restaurant_id === scope?.restaurantId);
    if (restRow) return restRow.enabled;

    const tenantRow = rows.find((r) => r.organization_id === scope?.tenantId);
    if (tenantRow) return tenantRow.enabled;

    const envRow = rows.find((r) => r.environment === env);
    if (envRow) return envRow.enabled;

    return this.globalDefaults.get(key) ?? false;
  }
}

export const featureFlagService = new FeatureFlagService();
