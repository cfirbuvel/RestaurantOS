import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, publicRateLimiter } from "@/modules/public-ordering/security/rate-limiter";
import { checkoutService } from "@/modules/public-ordering/services/checkout-service";
import { memoryDb } from "@/core/database/db";

describe("Phase 9: Public Ordering Security & Integrity", () => {
  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
    publicRateLimiter.reset();
  });

  describe("Rate Limiting Enforcement", () => {
    it("should allow requests under the limit and block subsequent requests exceeding the limit", () => {
      const limiter = new RateLimiter();
      const clientIp = "192.168.1.100";
      const maxRequests = 5;
      const windowMs = 10000;

      // Make 5 permitted requests
      for (let i = 0; i < maxRequests; i++) {
        const res = limiter.check(clientIp, maxRequests, windowMs);
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(maxRequests - 1 - i);
      }

      // 6th request must be blocked
      const blockedRes = limiter.check(clientIp, maxRequests, windowMs);
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
    });
  });

  describe("Price Manipulation Defense (Server-Authoritative)", () => {
    it("should ignore tampered client prices and compute real menu price from database", async () => {
      const seededProds = memoryDb.find("products", () => true);
      const testProd = seededProds[0];
      const realPrice = Number(testProd.base_price);

      // Malicious client tries to send price: 1.00 NIS
      const tamperedPrice = 1.0;

      const validation = await checkoutService.validateCart("israeli-burgers", {
        items: [
          {
            productId: testProd.id,
            quantity: 1,
            selectedModifiers: [{ modifierId: "mod-m" }],
          },
        ],
        orderType: "DELIVERY",
      });

      expect(validation.isValid).toBe(true);
      // The server must calculate using real base price from database
      expect(validation.cart.items[0].basePrice).toBe(realPrice);
      expect(validation.cart.subtotal).toBe(realPrice);
      expect(validation.cart.subtotal).not.toBe(tamperedPrice);
    });
  });

  describe("Coupon Abuse Defense", () => {
    it("should reject non-existent or manipulated coupon codes", async () => {
      const seededProds = memoryDb.find("products", () => true);
      const testProd = seededProds[0];

      const validation = await checkoutService.validateCart("israeli-burgers", {
        items: [
          {
            productId: testProd.id,
            quantity: 1,
            selectedModifiers: [{ modifierId: "mod-m" }],
          },
        ],
        orderType: "DELIVERY",
        couponCode: "HACK_FREE_FOOD_100",
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("INVALID_COUPON"))).toBe(true);
      expect(validation.cart.discountAmount).toBe(0);
    });

    it("should accept valid promotional codes within bounds", async () => {
      const seededProds = memoryDb.find("products", () => true);
      const testProd = seededProds[0];

      const validation = await checkoutService.validateCart("israeli-burgers", {
        items: [
          {
            productId: testProd.id,
            quantity: 2,
            selectedModifiers: [{ modifierId: "mod-m" }],
          },
        ],
        orderType: "DELIVERY",
        couponCode: "WELCOME10",
      });

      expect(validation.isValid).toBe(true);
      expect(validation.cart.discountAmount).toBeGreaterThan(0);
    });
  });
});
