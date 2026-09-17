import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateItemTotal,
  calculateCartTotals,
  validateCartConstraints,
  CartItem,
} from "@/modules/public-ordering/domain/cart";
import { checkoutService } from "@/modules/public-ordering/services/checkout-service";
import { memoryDb } from "@/core/database/db";

describe("Phase 9: Public Ordering & Cart Engine", () => {
  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  describe("Cart Price & VAT Calculations", () => {
    it("should correctly compute item total with modifiers and quantities", () => {
      const basePrice = 50;
      const modifiers = [
        { modifierId: "mod-1", name: "תוספת גבינה", priceAdjustment: 6 },
        { modifierId: "mod-2", name: "בצל מטוגן", priceAdjustment: 4 },
      ];
      const quantity = 3;

      const total = calculateItemTotal(basePrice, modifiers, quantity);
      // (50 + 6 + 4) * 3 = 60 * 3 = 180
      expect(total).toBe(180.0);
    });

    it("should calculate cart totals including embedded 17% VAT for delivery order", () => {
      const items: CartItem[] = [
        {
          id: "item-1",
          productId: "prod-1",
          name: "המבורגר קלאסי",
          basePrice: 50,
          quantity: 2,
          selectedModifiers: [],
          itemTotal: 100,
        },
      ];

      const cart = calculateCartTotals(items, "DELIVERY", {
        deliveryFee: 15.0,
        discountAmount: 10.0,
        tipAmount: 5.0,
        vatRate: 0.17,
      });

      // Subtotal = 100
      // Discount = 10 -> Discounted Subtotal = 90
      // Delivery Fee = 15
      // Tip = 5
      // Total = 90 + 15 + 5 = 110.00
      expect(cart.subtotal).toBe(100.0);
      expect(cart.discountAmount).toBe(10.0);
      expect(cart.deliveryFee).toBe(15.0);
      expect(cart.tipAmount).toBe(5.0);
      expect(cart.totalAmount).toBe(110.0);
      expect(cart.vatAmount).toBeGreaterThan(0);
    });

    it("should set delivery fee to 0 for TAKEAWAY and DINE_IN orders", () => {
      const items: CartItem[] = [
        {
          id: "item-1",
          productId: "prod-1",
          name: "המבורגר שורטק",
          basePrice: 65,
          quantity: 1,
          selectedModifiers: [],
          itemTotal: 65,
        },
      ];

      const cartTakeaway = calculateCartTotals(items, "TAKEAWAY", {
        deliveryFee: 15.0,
      });
      expect(cartTakeaway.deliveryFee).toBe(0);
      expect(cartTakeaway.totalAmount).toBe(65.0);

      const cartDineIn = calculateCartTotals(items, "DINE_IN", {
        deliveryFee: 15.0,
      });
      expect(cartDineIn.deliveryFee).toBe(0);
      expect(cartDineIn.totalAmount).toBe(65.0);
    });
  });

  describe("Cart Validation & Constraints", () => {
    it("should fail validation on empty cart", () => {
      const emptyCart = calculateCartTotals([], "DELIVERY");
      const validation = validateCartConstraints(emptyCart, { minOrderAmount: 50 });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("CART_EMPTY"))).toBe(true);
    });

    it("should fail validation if minimum order amount is not met for delivery", () => {
      const items: CartItem[] = [
        {
          id: "item-1",
          productId: "prod-1",
          name: "שתייה קלה",
          basePrice: 12,
          quantity: 1,
          selectedModifiers: [],
          itemTotal: 12,
        },
      ];
      const cart = calculateCartTotals(items, "DELIVERY");
      const validation = validateCartConstraints(cart, { minOrderAmount: 50 });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("MIN_ORDER_NOT_MET"))).toBe(true);
    });

    it("should pass validation when minimum order amount is satisfied", () => {
      const items: CartItem[] = [
        {
          id: "item-1",
          productId: "prod-1",
          name: "ארוחת המבורגר",
          basePrice: 68,
          quantity: 1,
          selectedModifiers: [],
          itemTotal: 68,
        },
      ];
      const cart = calculateCartTotals(items, "DELIVERY");
      const validation = validateCartConstraints(cart, { minOrderAmount: 50 });

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("Server-Side Cart Validation & Checkout Flow", () => {
    it("should validate live menu products and compute server-authoritative totals", async () => {
      // Find a seeded product from memoryDb
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
      expect(validation.cart.items).toHaveLength(1);
      expect(validation.cart.discountAmount).toBeGreaterThan(0);
    });

    it("should process checkout with Cash on Delivery and return order tracking URL", async () => {
      const seededProds = memoryDb.find("products", () => true);
      const testProd = seededProds[0];

      const response = await checkoutService.processCheckout("israeli-burgers", {
        items: [
          {
            id: "temp-1",
            productId: testProd.id,
            name: testProd.name,
            basePrice: Number(testProd.base_price),
            quantity: 1,
            selectedModifiers: [{ modifierId: "mod-m", priceAdjustment: 0 }],
          },
        ],
        orderType: "DELIVERY",
        channel: "WEB",
        customer: {
          name: "רועי כהן",
          phone: "054-1122334",
          email: "roei@test.com",
        },
        deliveryAddress: {
          city: "תל אביב",
          street: "דיזנגוף",
          houseNumber: "100",
        },
        paymentMethod: "CASH",
        tipAmount: 0,
      });

      expect(response.success).toBe(true);
      expect(response.orderId).toBeDefined();
      expect(response.orderNumber).toBeDefined();
      expect(response.trackingToken).toBeDefined();
      expect(response.trackingUrl).toContain("/order/");
      expect(response.paymentStatus).toBe("PAY_ON_DELIVERY");
      expect(response.channel).toBe("WEB");
    });
  });
});
