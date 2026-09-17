import { describe, it, expect, beforeEach } from "vitest";
import { CouponService } from "../../src/modules/marketing/services/coupon-service";
import { validateCoupon } from "../../src/modules/marketing/domain/marketing";
import type { Coupon, CouponValidationContext } from "../../src/modules/marketing/domain/marketing";

describe("Phase 6: Coupon Validation & Redemption", () => {
  let service: CouponService;
  const tenantId = "org_tenant_coupons";

  beforeEach(() => {
    service = new CouponService();
  });

  // ---------------------------------------------------------------------------
  // Coupon Creation
  // ---------------------------------------------------------------------------

  it("should create a reusable coupon with uppercase code", () => {
    const coupon = service.createCoupon(tenantId, {
      code: "summer20",
      scope: "REUSABLE",
      discountType: "PERCENTAGE",
      discountValue: 20,
    });

    expect(coupon.code).toBe("SUMMER20");
    expect(coupon.status).toBe("ACTIVE");
    expect(coupon.scope).toBe("REUSABLE");
    expect(coupon.usage_count).toBe(0);
  });

  it("should reject duplicate coupon codes within the same tenant", () => {
    service.createCoupon(tenantId, { code: "UNIQUE1", discountType: "FIXED_AMOUNT", discountValue: 10 });
    expect(() =>
      service.createCoupon(tenantId, { code: "UNIQUE1", discountType: "FIXED_AMOUNT", discountValue: 5 })
    ).toThrow("COUPON_CODE_ALREADY_EXISTS");
  });

  // ---------------------------------------------------------------------------
  // Coupon Validation — Expiration
  // ---------------------------------------------------------------------------

  it("should reject expired coupons", () => {
    const coupon = service.createCoupon(tenantId, {
      code: "EXPIRED1",
      discountType: "PERCENTAGE",
      discountValue: 10,
      expirationDate: new Date("2020-01-01").toISOString(),
    });

    const result = service.validateCouponCode(tenantId, "EXPIRED1", "cust_1", 100, "brn_1", "WEB");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_EXPIRED");
  });

  it("should reject coupons not yet activated", () => {
    service.createCoupon(tenantId, {
      code: "FUTURE1",
      discountType: "PERCENTAGE",
      discountValue: 10,
      activationDate: new Date(Date.now() + 86400000).toISOString(),
    });

    const result = service.validateCouponCode(tenantId, "FUTURE1", "cust_1", 100, "brn_1", "WEB");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_NOT_YET_ACTIVE");
  });

  // ---------------------------------------------------------------------------
  // Coupon Validation — Usage Limits
  // ---------------------------------------------------------------------------

  it("should reject coupons that have reached global usage limit", () => {
    const coupon = service.createCoupon(tenantId, {
      code: "LIMITED1",
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      usageLimitGlobal: 1,
    });

    // First redemption should succeed
    service.redeemCoupon(tenantId, "LIMITED1", "cust_1", "ord_1", 100, "brn_1", "WEB");

    // Second should fail — exhausted
    const result = service.validateCouponCode(tenantId, "LIMITED1", "cust_2", 100, "brn_1", "WEB");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_EXHAUSTED");
  });

  it("should enforce per-customer usage limit", () => {
    service.createCoupon(tenantId, {
      code: "PERCUST1",
      discountType: "PERCENTAGE",
      discountValue: 15,
      usageLimitPerCustomer: 2,
      usageLimitGlobal: 100,
    });

    // Customer uses it twice
    service.redeemCoupon(tenantId, "PERCUST1", "cust_1", "ord_1", 100, "brn_1", "WEB");
    service.redeemCoupon(tenantId, "PERCUST1", "cust_1", "ord_2", 100, "brn_1", "WEB");

    // Third attempt by same customer should fail
    const result = service.validateCouponCode(tenantId, "PERCUST1", "cust_1", 100, "brn_1", "WEB");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_CUSTOMER_LIMIT");

    // Different customer should still work
    const result2 = service.validateCouponCode(tenantId, "PERCUST1", "cust_2", 100, "brn_1", "WEB");
    expect(result2.valid).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Coupon Validation — Minimum Order Amount
  // ---------------------------------------------------------------------------

  it("should reject coupons when order does not meet minimum amount", () => {
    service.createCoupon(tenantId, {
      code: "MINORDER1",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minOrderAmount: 100,
    });

    const result = service.validateCouponCode(tenantId, "MINORDER1", "cust_1", 50, "brn_1", "WEB");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_MIN_ORDER_NOT_MET");
  });

  // ---------------------------------------------------------------------------
  // Coupon Validation — Maximum Discount Cap
  // ---------------------------------------------------------------------------

  it("should apply maximum discount cap", () => {
    service.createCoupon(tenantId, {
      code: "CAPPED1",
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscountAmount: 30,
    });

    const result = service.validateCouponCode(tenantId, "CAPPED1", "cust_1", 200, "brn_1", "WEB");
    expect(result.valid).toBe(true);
    // 50% of 200 = 100, but capped at 30
    expect(result.calculatedDiscount).toBe(30);
  });

  // ---------------------------------------------------------------------------
  // Coupon Validation — Branch & Channel Restrictions
  // ---------------------------------------------------------------------------

  it("should reject coupons restricted to a different branch", () => {
    service.createCoupon(tenantId, {
      code: "BRANCH1",
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      branchRestriction: ["brn_specific"],
    });

    const result = service.validateCouponCode(tenantId, "BRANCH1", "cust_1", 100, "brn_other", "WEB");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_BRANCH_RESTRICTED");
  });

  it("should reject coupons restricted to a different channel", () => {
    service.createCoupon(tenantId, {
      code: "CHANNEL1",
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      channelRestriction: ["WEB", "KIOSK"],
    });

    const result = service.validateCouponCode(tenantId, "CHANNEL1", "cust_1", 100, "brn_1", "PHONE");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_CHANNEL_RESTRICTED");
  });

  // ---------------------------------------------------------------------------
  // Coupon Validation — Customer-Specific
  // ---------------------------------------------------------------------------

  it("should reject customer-specific coupons for wrong customer", () => {
    service.createCoupon(tenantId, {
      code: "PERSONAL1",
      scope: "CUSTOMER_SPECIFIC",
      discountType: "PERCENTAGE",
      discountValue: 25,
      customerId: "cust_vip",
    });

    const result = service.validateCouponCode(tenantId, "PERSONAL1", "cust_other", 100, "brn_1", "WEB");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_NOT_FOR_CUSTOMER");
  });

  // ---------------------------------------------------------------------------
  // Coupon Redemption & Rollback
  // ---------------------------------------------------------------------------

  it("should successfully redeem a valid coupon", () => {
    service.createCoupon(tenantId, {
      code: "REDEEM1",
      discountType: "FIXED_AMOUNT",
      discountValue: 20,
    });

    const redemption = service.redeemCoupon(tenantId, "REDEEM1", "cust_1", "ord_1", 100, "brn_1", "WEB");

    expect(redemption.discount_applied).toBe(20);
    expect(redemption.rolled_back).toBe(false);
    expect(redemption.coupon_id).toBeTruthy();
  });

  it("should rollback redemption on order cancellation", () => {
    service.createCoupon(tenantId, {
      code: "ROLLBACK1",
      discountType: "PERCENTAGE",
      discountValue: 10,
      usageLimitGlobal: 5,
    });

    service.redeemCoupon(tenantId, "ROLLBACK1", "cust_1", "ord_1", 100, "brn_1", "WEB");
    const couponBefore = service.findCouponByCode(tenantId, "ROLLBACK1")!;
    expect(couponBefore.usage_count).toBe(1);

    const rolledBack = service.rollbackRedemption(tenantId, "ord_1");
    expect(rolledBack).not.toBeNull();
    expect(rolledBack!.rolled_back).toBe(true);

    const couponAfter = service.findCouponByCode(tenantId, "ROLLBACK1")!;
    expect(couponAfter.usage_count).toBe(0);
  });

  it("should re-activate exhausted coupon after rollback", () => {
    service.createCoupon(tenantId, {
      code: "EXHAUST1",
      discountType: "FIXED_AMOUNT",
      discountValue: 5,
      usageLimitGlobal: 1,
    });

    service.redeemCoupon(tenantId, "EXHAUST1", "cust_1", "ord_1", 100, "brn_1", "WEB");
    const exhausted = service.findCouponByCode(tenantId, "EXHAUST1")!;
    expect(exhausted.status).toBe("EXHAUSTED");

    service.rollbackRedemption(tenantId, "ord_1");
    const reactivated = service.findCouponByCode(tenantId, "EXHAUST1")!;
    expect(reactivated.status).toBe("ACTIVE");
  });

  // ---------------------------------------------------------------------------
  // Tenant Isolation
  // ---------------------------------------------------------------------------

  it("should return null for cross-tenant coupon lookup", () => {
    service.createCoupon(tenantId, {
      code: "TENANT_A",
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
    });

    expect(service.findCouponByCode("org_other_tenant", "TENANT_A")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Bulk Generation
  // ---------------------------------------------------------------------------

  it("should generate bulk unique coupon codes", () => {
    const coupons = service.generateBulkCoupons(tenantId, "cmp_summer", 5, {
      discountType: "PERCENTAGE",
      discountValue: 15,
    });

    expect(coupons).toHaveLength(5);
    const codes = new Set(coupons.map((c) => c.code));
    expect(codes.size).toBe(5); // All unique
    expect(coupons.every((c) => c.scope === "UNIQUE")).toBe(true);
    expect(coupons.every((c) => c.campaign_id === "cmp_summer")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Domain-level validateCoupon helper
  // ---------------------------------------------------------------------------

  it("should validate inactive coupons at domain level", () => {
    const coupon: Coupon = {
      id: "cpn_test", tenant_id: tenantId, code: "INACTIVE",
      scope: "REUSABLE", status: "DISABLED", discount_type: "FIXED_AMOUNT",
      discount_value: 10, usage_count: 0, created_at: new Date(),
      updated_at: new Date(), version: 1,
    };

    const ctx: CouponValidationContext = {
      coupon, orderSubtotal: 100, branchId: "brn_1",
      channel: "WEB", customerRedemptionCount: 0,
    };

    const result = validateCoupon(ctx);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("COUPON_INACTIVE");
  });
});
