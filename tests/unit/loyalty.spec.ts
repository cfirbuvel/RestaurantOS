import { describe, it, expect, beforeEach } from "vitest";
import { LoyaltyService } from "../../src/modules/marketing/services/loyalty-service";
import { calculateLoyaltyTier, LOYALTY_TIER_LABELS } from "../../src/modules/marketing/domain/marketing";

describe("Phase 6: Loyalty Points Engine & Tier Management", () => {
  let service: LoyaltyService;
  const tenantId = "org_tenant_loyalty";

  beforeEach(() => {
    service = new LoyaltyService();
    // Create a standard loyalty program
    service.createProgram(tenantId, {
      name: "Restaurant Points",
      pointsDisplayName: "points",
      pointsPerCurrencyUnit: 1,
      currencyPerPoint: 0.10,
      regularThreshold: 500,
      vipThreshold: 2000,
    });
  });

  // ---------------------------------------------------------------------------
  // Loyalty Program Configuration
  // ---------------------------------------------------------------------------

  it("should create a loyalty program with configurable thresholds", () => {
    const program = service.getProgram(tenantId)!;
    expect(program.name).toBe("Restaurant Points");
    expect(program.regular_threshold).toBe(500);
    expect(program.vip_threshold).toBe(2000);
    expect(program.points_per_currency_unit).toBe(1);
    expect(program.is_active).toBe(true);
  });

  it("should reject creating a duplicate loyalty program for the same tenant", () => {
    expect(() =>
      service.createProgram(tenantId, { name: "Duplicate" })
    ).toThrow("LOYALTY_PROGRAM_ALREADY_EXISTS");
  });

  it("should update loyalty program settings", () => {
    const updated = service.updateProgram(tenantId, { vipThreshold: 3000 });
    expect(updated.vip_threshold).toBe(3000);
  });

  // ---------------------------------------------------------------------------
  // Points Earning
  // ---------------------------------------------------------------------------

  it("should earn points on order completion", () => {
    const result = service.earnPoints(tenantId, "cust_1", 150, "ord_1");

    expect(result.account.current_points).toBe(150);
    expect(result.account.lifetime_points).toBe(150);
    expect(result.transaction.type).toBe("EARN");
    expect(result.transaction.points).toBe(150);
    expect(result.transaction.balance_after).toBe(150);
    expect(result.transaction.order_id).toBe("ord_1");
  });

  it("should accumulate points across multiple orders", () => {
    service.earnPoints(tenantId, "cust_1", 100, "ord_1");
    service.earnPoints(tenantId, "cust_1", 200, "ord_2");
    const { account } = service.earnPoints(tenantId, "cust_1", 50, "ord_3");

    expect(account.current_points).toBe(350);
    expect(account.lifetime_points).toBe(350);
  });

  it("should auto-create loyalty account on first earn", () => {
    expect(service.getAccount(tenantId, "cust_new")).toBeNull();

    service.earnPoints(tenantId, "cust_new", 100, "ord_1");

    const account = service.getAccount(tenantId, "cust_new");
    expect(account).not.toBeNull();
    expect(account!.current_points).toBe(100);
  });

  // ---------------------------------------------------------------------------
  // Tier Calculation — 3 Tiers (לקוח חדש / לקוח קבוע / לקוח VIP)
  // ---------------------------------------------------------------------------

  it("should start as NEW_CUSTOMER (לקוח חדש) tier", () => {
    const { account } = service.earnPoints(tenantId, "cust_1", 100, "ord_1");
    expect(account.current_tier).toBe("NEW_CUSTOMER");
    expect(LOYALTY_TIER_LABELS.NEW_CUSTOMER).toBe("לקוח חדש");
  });

  it("should promote to REGULAR (לקוח קבוע) at 500 lifetime points", () => {
    const result = service.earnPoints(tenantId, "cust_1", 500, "ord_1");
    expect(result.account.current_tier).toBe("REGULAR");
    expect(result.tierChanged).toBe(true);
    expect(result.previousTier).toBe("NEW_CUSTOMER");
    expect(result.newTier).toBe("REGULAR");
    expect(LOYALTY_TIER_LABELS.REGULAR).toBe("לקוח קבוע");
  });

  it("should promote to VIP (לקוח VIP) at 2000 lifetime points", () => {
    service.earnPoints(tenantId, "cust_1", 1500, "ord_1");
    const result = service.earnPoints(tenantId, "cust_1", 500, "ord_2");
    expect(result.account.current_tier).toBe("VIP");
    expect(result.tierChanged).toBe(true);
    expect(result.previousTier).toBe("REGULAR");
    expect(result.newTier).toBe("VIP");
    expect(LOYALTY_TIER_LABELS.VIP).toBe("לקוח VIP");
  });

  it("should calculate tiers deterministically via calculateLoyaltyTier", () => {
    const thresholds = { regular_threshold: 500, vip_threshold: 2000 };

    expect(calculateLoyaltyTier(0, thresholds)).toBe("NEW_CUSTOMER");
    expect(calculateLoyaltyTier(499, thresholds)).toBe("NEW_CUSTOMER");
    expect(calculateLoyaltyTier(500, thresholds)).toBe("REGULAR");
    expect(calculateLoyaltyTier(1999, thresholds)).toBe("REGULAR");
    expect(calculateLoyaltyTier(2000, thresholds)).toBe("VIP");
    expect(calculateLoyaltyTier(99999, thresholds)).toBe("VIP");
  });

  // ---------------------------------------------------------------------------
  // Points Redemption
  // ---------------------------------------------------------------------------

  it("should redeem points with correct currency value", () => {
    service.earnPoints(tenantId, "cust_1", 500, "ord_1");

    const result = service.redeemPoints(tenantId, "cust_1", {
      points: 100,
      orderId: "ord_2",
    });

    expect(result.account.current_points).toBe(400);
    expect(result.transaction.type).toBe("REDEEM");
    expect(result.transaction.points).toBe(-100);
    expect(result.currencyValue).toBe(10); // 100 points × 0.10 = ₪10
  });

  it("should reject redemption when insufficient points", () => {
    service.earnPoints(tenantId, "cust_1", 50, "ord_1");

    expect(() =>
      service.redeemPoints(tenantId, "cust_1", { points: 100 })
    ).toThrow("INSUFFICIENT_POINTS");
  });

  it("should reject redemption for non-existent account", () => {
    expect(() =>
      service.redeemPoints(tenantId, "cust_nonexistent", { points: 10 })
    ).toThrow("LOYALTY_ACCOUNT_NOT_FOUND");
  });

  // ---------------------------------------------------------------------------
  // Points Rollback (Order Cancellation)
  // ---------------------------------------------------------------------------

  it("should rollback points on order cancellation", () => {
    service.earnPoints(tenantId, "cust_1", 200, "ord_1");
    service.earnPoints(tenantId, "cust_1", 100, "ord_2");

    const result = service.rollbackPoints(tenantId, "cust_1", "ord_1");

    expect(result).not.toBeNull();
    expect(result!.account.current_points).toBe(100);
    expect(result!.account.lifetime_points).toBe(100);
    expect(result!.transaction.type).toBe("ADJUSTMENT");
    expect(result!.transaction.points).toBe(-200);
  });

  it("should demote tier after points rollback", () => {
    service.earnPoints(tenantId, "cust_1", 600, "ord_1");
    expect(service.getAccount(tenantId, "cust_1")!.current_tier).toBe("REGULAR");

    const result = service.rollbackPoints(tenantId, "cust_1", "ord_1");
    expect(result!.tierChanged).toBe(true);
    expect(result!.previousTier).toBe("REGULAR");
    expect(result!.newTier).toBe("NEW_CUSTOMER");
    expect(result!.account.current_tier).toBe("NEW_CUSTOMER");
  });

  it("should return null when rolling back non-existent order", () => {
    service.earnPoints(tenantId, "cust_1", 100, "ord_1");
    const result = service.rollbackPoints(tenantId, "cust_1", "ord_nonexistent");
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Points History
  // ---------------------------------------------------------------------------

  it("should return paginated points history", () => {
    service.earnPoints(tenantId, "cust_1", 100, "ord_1");
    service.earnPoints(tenantId, "cust_1", 200, "ord_2");
    service.redeemPoints(tenantId, "cust_1", { points: 50, orderId: "ord_3" });

    const history = service.getPointsHistory(tenantId, "cust_1");
    expect(history.total).toBe(3);
    expect(history.data).toHaveLength(3);
    // Most recent first
    expect(history.data[0].type).toBe("REDEEM");
  });

  // ---------------------------------------------------------------------------
  // Tenant Isolation
  // ---------------------------------------------------------------------------

  it("should isolate loyalty accounts across tenants", () => {
    service.earnPoints(tenantId, "cust_1", 500, "ord_1");
    expect(service.getAccount("org_other_tenant", "cust_1")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Hebrew Tier Labels
  // ---------------------------------------------------------------------------

  it("should provide Hebrew tier labels", () => {
    expect(service.getTierLabel("NEW_CUSTOMER")).toBe("לקוח חדש");
    expect(service.getTierLabel("REGULAR")).toBe("לקוח קבוע");
    expect(service.getTierLabel("VIP")).toBe("לקוח VIP");
  });
});
