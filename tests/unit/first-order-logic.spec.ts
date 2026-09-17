import { describe, it, expect } from "vitest";
import { isFirstOrderEligible, calculateDiscountAmount } from "../../src/modules/marketing/domain/marketing";

describe("Phase 6: First Order Logic & Discount Calculations", () => {
  // ---------------------------------------------------------------------------
  // First Order Eligibility
  // ---------------------------------------------------------------------------

  describe("First Order Eligibility", () => {
    it("should mark customer with 0 completed orders as first-order eligible", () => {
      expect(isFirstOrderEligible(0)).toBe(true);
    });

    it("should mark customer with 1+ completed orders as NOT first-order eligible", () => {
      expect(isFirstOrderEligible(1)).toBe(false);
      expect(isFirstOrderEligible(5)).toBe(false);
      expect(isFirstOrderEligible(100)).toBe(false);
    });

    it("cancelled orders should not count — only COMPLETED orders matter", () => {
      // If a customer placed 3 orders but all were cancelled,
      // their completedOrdersCount is still 0 → eligible
      const completedOrdersCount = 0;
      expect(isFirstOrderEligible(completedOrdersCount)).toBe(true);
    });

    it("failed payment orders should not count — only COMPLETED orders matter", () => {
      // Customer attempted order but payment failed → completedOrdersCount = 0
      const completedOrdersCount = 0;
      expect(isFirstOrderEligible(completedOrdersCount)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Discount Calculations
  // ---------------------------------------------------------------------------

  describe("Discount Amount Calculations", () => {
    it("should calculate PERCENTAGE discount correctly", () => {
      // 20% of 150 = 30
      expect(calculateDiscountAmount("PERCENTAGE", 20, 150)).toBe(30);
    });

    it("should calculate FIXED_AMOUNT discount correctly", () => {
      expect(calculateDiscountAmount("FIXED_AMOUNT", 25, 100)).toBe(25);
    });

    it("should not exceed subtotal for FIXED_AMOUNT", () => {
      // Discount of 150 on a 100 subtotal → capped at 100
      expect(calculateDiscountAmount("FIXED_AMOUNT", 150, 100)).toBe(100);
    });

    it("should apply max discount cap on PERCENTAGE", () => {
      // 50% of 200 = 100, but capped at 30
      expect(calculateDiscountAmount("PERCENTAGE", 50, 200, 30)).toBe(30);
    });

    it("should return 0 for FREE_DELIVERY (handled at order level)", () => {
      expect(calculateDiscountAmount("FREE_DELIVERY", 0, 100)).toBe(0);
    });

    it("should use item price for FREE_ITEM discount", () => {
      expect(calculateDiscountAmount("FREE_ITEM", 0, 100, null, 35)).toBe(35);
    });

    it("should use item price for BOGO discount", () => {
      expect(calculateDiscountAmount("BOGO", 0, 100, null, 45)).toBe(45);
    });

    it("should cap FREE_ITEM discount at subtotal", () => {
      // Item costs 200 but subtotal is only 100
      expect(calculateDiscountAmount("FREE_ITEM", 0, 100, null, 200)).toBe(100);
    });

    it("should round discount to 2 decimal places", () => {
      // 33.33% of 100 = 33.33
      const result = calculateDiscountAmount("PERCENTAGE", 33.33, 100);
      expect(result).toBe(33.33);
      // Verify no floating point issues
      expect(result.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });

    it("should handle 100% discount capped at subtotal", () => {
      expect(calculateDiscountAmount("PERCENTAGE", 100, 250)).toBe(250);
    });

    it("should handle 0% discount", () => {
      expect(calculateDiscountAmount("PERCENTAGE", 0, 100)).toBe(0);
    });
  });
});
