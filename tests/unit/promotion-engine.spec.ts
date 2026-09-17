import { describe, it, expect, beforeEach } from "vitest";
import { PromotionEngine } from "../../src/modules/marketing/services/promotion-engine";
import type { Promotion, PromotionOrderContext } from "../../src/modules/marketing/domain/marketing";

describe("Phase 6: Promotion Engine — Deterministic Rule Evaluation", () => {
  let engine: PromotionEngine;
  const tenantId = "org_tenant_promos";

  beforeEach(() => {
    engine = new PromotionEngine();
  });

  // Helper to build a standard order context
  function orderContext(overrides: Partial<PromotionOrderContext> = {}): PromotionOrderContext {
    return {
      tenantId,
      branchId: "brn_1",
      channel: "WEB",
      orderType: "DELIVERY",
      customerId: "cust_1",
      customerProfile: {
        isFirstOrder: false,
        totalOrdersCount: 10,
        totalSpentAmount: 2500,
        isVip: false,
        isBirthday: false,
        loyaltyTier: "REGULAR",
      },
      items: [
        { productId: "prod_burger", categoryId: "cat_main", quantity: 2, unitPrice: 50 },
      ],
      subtotal: 100,
      ...overrides,
    };
  }

  // ---------------------------------------------------------------------------
  // Rule Evaluation
  // ---------------------------------------------------------------------------

  it("should apply first-order discount: IF first_order = true AND subtotal >= 100 THEN 20% off", () => {
    engine.createPromotion(tenantId, {
      name: "First Order 20%",
      conditions: [
        { field: "customer.isFirstOrder", operator: "EQUALS", value: true },
        { field: "order.subtotal", operator: "GREATER_THAN_OR_EQUAL", value: 100 },
      ],
      discountType: "PERCENTAGE",
      discountValue: 20,
      priority: 10,
      stackMode: "EXCLUSIVE",
    });

    const ctx = orderContext({
      subtotal: 150,
      customerProfile: {
        isFirstOrder: true,
        totalOrdersCount: 0,
        totalSpentAmount: 0,
        isVip: false,
        isBirthday: false,
      },
    });

    const result = engine.evaluatePromotions(ctx);
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].promotionName).toBe("First Order 20%");
    // 20% of 150 = 30
    expect(result.totalDiscount).toBe(30);
  });

  it("should NOT apply first-order discount when customer has previous orders", () => {
    engine.createPromotion(tenantId, {
      name: "First Order Only",
      conditions: [
        { field: "customer.isFirstOrder", operator: "EQUALS", value: true },
      ],
      discountType: "PERCENTAGE",
      discountValue: 15,
    });

    const ctx = orderContext(); // isFirstOrder = false by default
    const result = engine.evaluatePromotions(ctx);
    expect(result.appliedPromotions).toHaveLength(0);
    expect(result.totalDiscount).toBe(0);
  });

  it("should apply VIP-only promotion when customer is VIP", () => {
    engine.createPromotion(tenantId, {
      name: "VIP 10% Off",
      conditions: [
        { field: "customer.isVip", operator: "EQUALS", value: true },
      ],
      discountType: "PERCENTAGE",
      discountValue: 10,
    });

    const ctx = orderContext({
      customerProfile: {
        isFirstOrder: false,
        totalOrdersCount: 50,
        totalSpentAmount: 10000,
        isVip: true,
        isBirthday: false,
        loyaltyTier: "VIP",
      },
    });

    const result = engine.evaluatePromotions(ctx);
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.totalDiscount).toBe(10); // 10% of 100
  });

  it("should evaluate win-back promotion: days_since_last_order > 30", () => {
    engine.createPromotion(tenantId, {
      name: "Win Back",
      conditions: [
        { field: "customer.daysSinceLastOrder", operator: "GREATER_THAN", value: 30 },
      ],
      discountType: "FIXED_AMOUNT",
      discountValue: 25,
    });

    const ctx = orderContext({
      customerProfile: {
        isFirstOrder: false,
        totalOrdersCount: 5,
        totalSpentAmount: 500,
        isVip: false,
        isBirthday: false,
        daysSinceLastOrder: 45,
      },
    });

    const result = engine.evaluatePromotions(ctx);
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.totalDiscount).toBe(25);
  });

  // ---------------------------------------------------------------------------
  // Conflict Resolution: EXCLUSIVE
  // ---------------------------------------------------------------------------

  it("should apply only the highest priority EXCLUSIVE promotion", () => {
    engine.createPromotion(tenantId, {
      name: "Low Priority 5%",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "PERCENTAGE",
      discountValue: 5,
      priority: 1,
      stackMode: "EXCLUSIVE",
    });

    engine.createPromotion(tenantId, {
      name: "High Priority 15%",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "PERCENTAGE",
      discountValue: 15,
      priority: 10,
      stackMode: "EXCLUSIVE",
    });

    const result = engine.evaluatePromotions(orderContext());
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].promotionName).toBe("High Priority 15%");
    expect(result.totalDiscount).toBe(15); // 15% of 100
  });

  // ---------------------------------------------------------------------------
  // Conflict Resolution: STACKABLE
  // ---------------------------------------------------------------------------

  it("should accumulate STACKABLE promotions", () => {
    engine.createPromotion(tenantId, {
      name: "Stack A",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      stackMode: "STACKABLE",
    });

    engine.createPromotion(tenantId, {
      name: "Stack B",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 5,
      stackMode: "STACKABLE",
    });

    const result = engine.evaluatePromotions(orderContext());
    expect(result.appliedPromotions).toHaveLength(2);
    expect(result.totalDiscount).toBe(15); // 10 + 5
  });

  // ---------------------------------------------------------------------------
  // Conflict Resolution: BEST_DEAL
  // ---------------------------------------------------------------------------

  it("should select maximum discount among BEST_DEAL promotions", () => {
    engine.createPromotion(tenantId, {
      name: "Best A",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 8,
      stackMode: "BEST_DEAL",
    });

    engine.createPromotion(tenantId, {
      name: "Best B",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 20,
      stackMode: "BEST_DEAL",
    });

    const result = engine.evaluatePromotions(orderContext());
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].promotionName).toBe("Best B");
    expect(result.totalDiscount).toBe(20);
  });

  // ---------------------------------------------------------------------------
  // Maximum Discount Cap
  // ---------------------------------------------------------------------------

  it("should enforce maximum discount cap on promotions", () => {
    engine.createPromotion(tenantId, {
      name: "Capped 50%",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscountAmount: 20,
    });

    const result = engine.evaluatePromotions(orderContext({ subtotal: 200 }));
    expect(result.totalDiscount).toBe(20); // 50% of 200 = 100, but capped at 20
  });

  it("should cap total discount at subtotal", () => {
    engine.createPromotion(tenantId, {
      name: "Mega Stack A",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 80,
      stackMode: "STACKABLE",
    });

    engine.createPromotion(tenantId, {
      name: "Mega Stack B",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 80,
      stackMode: "STACKABLE",
    });

    // subtotal is 100, combined discount would be 160 — capped at 100
    const result = engine.evaluatePromotions(orderContext());
    expect(result.totalDiscount).toBe(100);
  });

  // ---------------------------------------------------------------------------
  // Explainability
  // ---------------------------------------------------------------------------

  it("should provide human-readable explanations for applied promotions", () => {
    engine.createPromotion(tenantId, {
      name: "Big Spender",
      conditions: [
        { field: "customer.totalSpentAmount", operator: "GREATER_THAN_OR_EQUAL", value: 1000 },
      ],
      discountType: "PERCENTAGE",
      discountValue: 10,
    });

    const result = engine.evaluatePromotions(orderContext());
    expect(result.explanations.length).toBeGreaterThan(0);
    expect(result.explanations[0]).toContain("Big Spender");
  });

  // ---------------------------------------------------------------------------
  // No Matches
  // ---------------------------------------------------------------------------

  it("should return empty result when no promotions match", () => {
    engine.createPromotion(tenantId, {
      name: "Unreachable",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 99999 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
    });

    const result = engine.evaluatePromotions(orderContext());
    expect(result.appliedPromotions).toHaveLength(0);
    expect(result.totalDiscount).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Tenant Isolation
  // ---------------------------------------------------------------------------

  it("should not apply promotions from a different tenant", () => {
    engine.createPromotion("org_other", {
      name: "Other Tenant",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 100,
    });

    const result = engine.evaluatePromotions(orderContext());
    expect(result.appliedPromotions).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Date Range Filtering
  // ---------------------------------------------------------------------------

  it("should skip expired promotions", () => {
    const promo = engine.createPromotion(tenantId, {
      name: "Expired Promo",
      conditions: [{ field: "order.subtotal", operator: "GREATER_THAN", value: 0 }],
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      endsAt: new Date("2020-01-01").toISOString(),
    });

    const result = engine.evaluatePromotions(orderContext());
    expect(result.appliedPromotions).toHaveLength(0);
  });
});
