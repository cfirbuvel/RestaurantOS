/**
 * RestaurantOS — Phase 12 QA: Complete End-to-End Business Flow Suite
 *
 * Mandated by RestaurantOS — 12 Complete QA.md:
 * Complete business lifecycles connecting all platform subsystems:
 *  1. Core Dining Flow: Customer -> Order -> Kitchen KDS -> Delivery -> Driver -> CRM -> Analytics
 *  2. Supply Chain Flow: Purchase/Transfer -> Recipe BOM -> Sale -> Stock Depletion -> Waste
 *  3. Marketing Flow: Campaign -> Coupon -> Order -> Redemption -> Loyalty Tier Progression
 */

import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { orderService } from "@/modules/orders/services/order-service";
import { kdsService } from "@/modules/kds/services/kds-service";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";
import { customerService } from "@/modules/crm/services/customer-service";
import { analyticsService } from "@/modules/analytics/services/analytics-service";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { recipeService } from "@/modules/inventory/services/recipe-service";
import { wasteService } from "@/modules/inventory/services/waste-service";
import { CampaignService } from "@/modules/marketing/services/campaign-service";
import { CouponService } from "@/modules/marketing/services/coupon-service";
import { LoyaltyService } from "@/modules/marketing/services/loyalty-service";
import { checkoutService } from "@/modules/public-ordering/services/checkout-service";

describe("Phase 12: End-to-End Business Lifecycles", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const userId = "c0ccd37f-a43a-4365-9093-d4158ee0f749";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  // ── 1. Core Order -> KDS -> Delivery -> CRM -> Analytics Lifecycle ────────

  it("Full Core Flow: Order -> KDS Station Bump -> Delivery Lifecycle -> CRM Updates -> Analytics", async () => {
    // Step 1: Customer creates an order (with required doneness modifier)
    const order = await orderService.createOrder({
      tenantId,
      branchId,
      channel: "WEB",
      orderType: "DELIVERY",
      actorId: "cust-yael-01",
      autoConfirm: true,
      items: [
        {
          productId: "prod-01-classic-burger",
          quantity: 2,
          selectedModifiers: [{ modifierId: "mod-m" }],
        },
      ],
    });

    expect(order.id).toBeDefined();
    expect(order.total_amount).toBe(116.0);

    // Step 2: KDS tickets generated for kitchen stations
    const tickets = await kdsService.routeOrderToStations(order, order.items!);
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    const burgerTicket = tickets.find((t) => t.station_id === "st-01-burgers");
    expect(burgerTicket).toBeDefined();

    // Step 3: Kitchen line cook starts, marks ready, and expo bumps ticket
    await kdsService.startTicket(tenantId, burgerTicket!.id, "cook-usr-01");
    await kdsService.readyTicket(tenantId, burgerTicket!.id, "cook-usr-01");
    const completedTicket = await kdsService.bumpTicket(tenantId, burgerTicket!.id, "expo-01");
    expect(completedTicket.status).toBe("COMPLETED");

    // Step 4: Delivery order is dispatched to an on-shift driver from the FIFO queue
    await driverQueueService.clockIn(tenantId, branchId, "driver-usr-flow-1");
    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: order.id,
      deliveryAddress: {
        street: "Dizengoff",
        houseNumber: "100",
        city: "Tel Aviv",
        latitude: 32.08,
        longitude: 34.78,
      },
    });

    // Manager assigns delivery to available driver
    const assigned = await deliveryService.assignDelivery({
      tenantId,
      deliveryId: delivery.id,
      driverId: "driver-usr-flow-1",
      actorId: userId,
      actorType: "MANAGER",
    });
    expect(assigned.status).toBe("ASSIGNED");

    // Driver picks up and starts transit
    await deliveryService.pickupDelivery(tenantId, delivery.id, "driver-usr-flow-1");
    await deliveryService.startDelivery(tenantId, delivery.id, "driver-usr-flow-1");
    await deliveryService.arriveDelivery(tenantId, delivery.id, "driver-usr-flow-1");
    const completedDelivery = await deliveryService.completeDelivery(tenantId, delivery.id, "driver-usr-flow-1");
    expect(completedDelivery.status).toBe("DELIVERED");

    // Step 5: CRM customer record is created/updated with order value
    const customer = await customerService.createCustomer(tenantId, {
      firstName: "Yael",
      lastName: "Levi",
      phone: "+972549998877",
      email: "yael@levi.il",
    });
    await customerService.recordOrderCompleted(tenantId, customer.id, order.total_amount);
    const updatedCustomer = await customerService.getCustomerById(tenantId, customer.id);
    expect(updatedCustomer?.total_orders_count).toBe(1);
    expect(updatedCustomer?.total_spent_amount).toBe(116.0);

    // Step 6: Analytics reflect gross revenue
    const dashboard = await analyticsService.getSalesDashboard(tenantId, branchId);
    expect(dashboard.orderCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.grossRevenue).toBeGreaterThanOrEqual(116.0);
  });

  // ── 2. Supply Chain -> Recipe BOM -> Depletion -> Waste Flow ───────────────

  it("Supply Chain Flow: Goods Transfer -> Recipe BOM Calculation -> Stock Depletion -> Waste Logging", async () => {
    // Step 1: Calculate Recipe BOM for order sale (e.g. 3 Classic Burgers)
    const bom = await recipeService.calculateBOM({
      tenantId,
      productId: "prod-01-classic-burger",
      quantity: 3,
    });
    expect(bom.portions).toBe(3);
    expect(bom.items.length).toBe(3); // Patty, Bun, Sauce

    // Step 2: Automated Stock Depletion for the order items
    const kitchenWhId = "wh-02-kitchen";
    const bunStockBefore = memoryDb.find(
      "inventory_stocks",
      (s: any) => s.warehouse_id === kitchenWhId && s.ingredient_id === "ing-02-burger-bun"
    )[0];
    const initialQty = bunStockBefore.quantity;

    const depletionResult = await inventoryService.depleteStockForOrder({
      tenantId,
      branchId,
      orderId: "ord-01-seed-sample",
      trigger: "ON_ACCEPTED",
      actorId: userId,
    });
    expect(depletionResult.depleted).toBe(true);
    expect(depletionResult.movementsCount).toBeGreaterThan(0);

    const bunStockAfter = memoryDb.find(
      "inventory_stocks",
      (s: any) => s.warehouse_id === kitchenWhId && s.ingredient_id === "ing-02-burger-bun"
    )[0];
    expect(bunStockAfter.quantity).toBe(initialQty - 1);

    // Step 3: Kitchen logs ingredient waste (e.g. expired burger buns)
    const wasteEntry = await wasteService.recordWaste({
      tenantId,
      branchId,
      warehouseId: kitchenWhId,
      ingredientId: "ing-02-burger-bun",
      quantity: 10,
      unitId: "unit",
      wasteReason: "EXPIRED",
      notes: "Dropped on floor during rush",
      reportedBy: userId,
    });
    expect(wasteEntry.id).toBeDefined();
    expect(wasteEntry.cost_impact).toBe(22.0);

    // Step 4: Verify stock levels exist
    const stock = await inventoryService.getOrCreateStock(tenantId, kitchenWhId, "ing-02-burger-bun");
    expect(stock.quantity).toBe(initialQty - 1 - 10);
  });

  // ── 3. Marketing Campaign -> Coupon -> Cart -> Loyalty Flow ────────────────

  it("Marketing Flow: Campaign -> Coupon Creation -> Cart Validation -> Redemption -> Loyalty Points", async () => {
    const campaignService = new CampaignService();
    const couponService = new CouponService();
    const loyaltyService = new LoyaltyService();

    // Step 1: Create and Activate Marketing Campaign
    const campaignDraft = campaignService.createCampaign(tenantId, {
      name: "Spring Sale 2026",
      type: "PERCENTAGE_DISCOUNT",
      discountValue: 10,
      startDate: new Date(Date.now() - 10000),
      endDate: new Date(Date.now() + 86400000),
    });
    const campaign = campaignService.transitionCampaign(tenantId, campaignDraft.id, "ACTIVE");
    expect(campaign.status).toBe("ACTIVE");

    // Step 2: Create targeted Coupon Code
    const coupon = couponService.createCoupon(tenantId, {
      code: "WELCOME10",
      campaignId: campaign.id,
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxUses: 100,
    });
    expect(coupon.code).toBe("WELCOME10");

    // Step 3: Public cart applies coupon and validates discount
    const cartValidation = await checkoutService.validateCart("israeli-burgers", {
      items: [
        {
          productId: "prod-01-classic-burger",
          quantity: 1,
          selectedModifiers: [{ modifierId: "mod-m" }],
        },
      ],
      orderType: "TAKEAWAY",
      couponCode: "WELCOME10",
    });
    expect(cartValidation.isValid).toBe(true);
    expect(cartValidation.cart.discountAmount).toBeGreaterThan(0);

    // Step 4: Customer redeems coupon upon checkout
    const redemption = couponService.redeemCoupon(tenantId, "WELCOME10", "cust-yael-01", "ord-yael-01", 58.0, branchId, "WEB");
    expect(redemption.coupon_id).toBe(coupon.id);

    // Step 5: Loyalty Points credited and tier updated
    loyaltyService.createProgram(tenantId, {
      name: "Burger Club",
      pointsPerCurrencyUnit: 1,
      regularThreshold: 100,
      vipThreshold: 500,
    });

    const earnResult = loyaltyService.earnPoints(tenantId, "cust-yael-01", 150);
    expect(earnResult.account.current_points).toBe(150);
    expect(earnResult.newTier).toBe("REGULAR");
  });
});
