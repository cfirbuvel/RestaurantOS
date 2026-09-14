import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { orderService } from "@/modules/orders/services/order-service";
import { menuService } from "@/modules/menu/services/menu-service";
import { customerService } from "@/modules/crm/services/customer-service";

describe("Universal Order Lifecycle & State Machine Subsystem", () => {
  const tenantId = "org-100-israeli-burgers";
  const branchId = "branch-100-main";
  const actorId = "usr-100-owner";

  let prodBurgerId: string;
  let prodFriesId: string;
  let customerId: string;
  let addressId: string;
  let modMediumId: string;

  beforeEach(async () => {
    memoryDb.reset();

    // Create customer & address
    const cust = await customerService.createCustomer(tenantId, {
      phone: "050-7776655",
      firstName: "עומר",
      lastName: "לוי",
    });
    customerId = cust.id;

    const addr = await customerService.addAddress(tenantId, customerId, {
      street: "הארבעה",
      houseNumber: "12",
      floor: "5",
      city: "תל אביב",
      gateCode: "4321",
      deliveryNotes: "להשאיר ליד הדלת",
      isDefault: true,
    });
    addressId = addr.id;

    // Create menu items
    const cat = await menuService.createCategory(tenantId, { name: "עיקריות" });
    const doneness = await menuService.createModifierGroup(tenantId, {
      name: "מידת עשייה",
      minSelection: 1,
      maxSelection: 1,
      isRequired: true,
      modifiers: [{ name: "M", priceAdjustment: 0 }, { name: "WD", priceAdjustment: 0 }],
    });
    modMediumId = doneness.modifiers![0].id;

    const burger = await menuService.createProduct(tenantId, {
      categoryId: cat.id,
      name: "המבורגר שורטק",
      basePrice: 55,
      modifierGroupIds: [doneness.id],
      variants: [{ name: "דאבל", priceAdjustment: 20 }],
    });
    prodBurgerId = burger.id;

    const fries = await menuService.createProduct(tenantId, {
      categoryId: cat.id,
      name: "צ'יפס",
      basePrice: 20,
    });
    prodFriesId = fries.id;
  });

  it("creates a universal order with item calculations, VAT, delivery fee, and outbox event", async () => {
    const order = await orderService.createOrder({
      tenantId,
      branchId,
      customerId,
      channel: "WEB",
      orderType: "DELIVERY",
      items: [
        {
          productId: prodBurgerId,
          quantity: 2,
          selectedModifiers: [{ modifierId: modMediumId }], // Doneness
        },
        {
          productId: prodFriesId,
          quantity: 1,
        },
      ],
      deliveryAddressId: addressId,
      deliveryFee: 15,
      tipAmount: 10,
      notes: "בבקשה הרבה קטשופ ומיונז",
      actorId,
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe("DRAFT");
    expect(order.payment_status).toBe("PENDING");
    // Subtotal: (55 * 2) + 20 = 130
    expect(order.subtotal).toBe(130);
    // Total: 130 + 15 (fee) + 10 (tip) = 155
    expect(order.total_amount).toBe(155);
    expect(order.items).toHaveLength(2);

    // Verify Outbox Event emitted
    const outbox = memoryDb.find("outbox_events", (e: any) => e.event_type === "OrderCreated");
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox[0].payload.orderId).toBe(order.id);
  });

  it("executes the full canonical order lifecycle via explicit domain commands", async () => {
    // 1. Create Order (DRAFT)
    const order = await orderService.createOrder({
      tenantId,
      branchId,
      customerId,
      channel: "POS",
      orderType: "DINE_IN",
      items: [{ productId: prodFriesId, quantity: 2 }],
      actorId,
    });
    expect(order.status).toBe("DRAFT");

    // 2. Confirm Order (DRAFT -> CONFIRMED)
    const confirmed = await orderService.confirmOrder(tenantId, order.id, actorId);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.payment_status).toBe("PAID");

    // 3. Accept Order by Kitchen (CONFIRMED -> ACCEPTED)
    const accepted = await orderService.acceptOrder(tenantId, order.id, 15, actorId);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.estimated_ready_at).toBeDefined();

    // 4. Start Preparation (ACCEPTED -> IN_PREPARATION)
    const inPrep = await orderService.startPreparation(tenantId, order.id, actorId);
    expect(inPrep.status).toBe("IN_PREPARATION");

    // 5. Kitchen Ready (IN_PREPARATION -> READY)
    const ready = await orderService.readyOrder(tenantId, order.id, actorId);
    expect(ready.status).toBe("READY");
    expect(ready.actual_ready_at).toBeDefined();

    // 6. Complete Order (READY -> COMPLETED)
    const completed = await orderService.completeOrder(tenantId, order.id, actorId);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completed_at).toBeDefined();

    // Verify customer metrics were updated on order completion
    const customer = await customerService.getCustomerById(tenantId, customerId);
    expect(customer?.total_orders_count).toBe(1);
    expect(customer?.total_spent_amount).toBe(completed.total_amount);

    // Verify all 6 events are present in transactional outbox
    const events = memoryDb.find("outbox_events", () => true).map((e: any) => e.event_type);
    expect(events).toContain("OrderCreated");
    expect(events).toContain("OrderConfirmed");
    expect(events).toContain("OrderAccepted");
    expect(events).toContain("OrderPreparationStarted");
    expect(events).toContain("OrderReady");
    expect(events).toContain("OrderCompleted");
  });

  it("rejects invalid state transitions according to canonical state machine", async () => {
    const order = await orderService.createOrder({
      tenantId,
      branchId,
      channel: "KIOSK",
      orderType: "TAKEAWAY",
      items: [{ productId: prodFriesId, quantity: 1 }],
      actorId,
    });

    // Cannot jump from DRAFT directly to READY
    await expect(orderService.readyOrder(tenantId, order.id, actorId)).rejects.toThrow(
      /cannot mark ready for order in status draft/i
    );

    // Cannot jump from DRAFT directly to COMPLETED
    await expect(orderService.completeOrder(tenantId, order.id, actorId)).rejects.toThrow(
      /cannot complete order in status draft/i
    );

    // Advance to COMPLETED
    await orderService.confirmOrder(tenantId, order.id, actorId);
    await orderService.acceptOrder(tenantId, order.id, 10, actorId);
    await orderService.startPreparation(tenantId, order.id, actorId);
    await orderService.readyOrder(tenantId, order.id, actorId);
    await orderService.completeOrder(tenantId, order.id, actorId);

    // Completed orders cannot be cancelled
    await expect(
      orderService.cancelOrder(tenantId, order.id, "Changed mind", actorId)
    ).rejects.toThrow(/cannot cancel order in status completed/i);
  });

  it("cancels an order with reason from valid states", async () => {
    const order = await orderService.createOrder({
      tenantId,
      branchId,
      channel: "PHONE",
      orderType: "TAKEAWAY",
      items: [{ productId: prodFriesId, quantity: 1 }],
      actorId,
    });

    await orderService.confirmOrder(tenantId, order.id, actorId);

    const cancelled = await orderService.cancelOrder(
      tenantId,
      order.id,
      "Customer called to cancel",
      actorId
    );

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancellation_reason).toBe("Customer called to cancel");
    expect(cancelled.cancelled_at).toBeDefined();

    const outbox = memoryDb.find("outbox_events", (e: any) => e.event_type === "OrderCancelled");
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox[0].payload.reason).toBe("Customer called to cancel");
  });

  it("applies delivery data minimization when order is fetched by a DRIVER role", async () => {
    const order = await orderService.createOrder({
      tenantId,
      branchId,
      customerId,
      channel: "WEB",
      orderType: "DELIVERY",
      items: [{ productId: prodFriesId, quantity: 2 }],
      deliveryAddressId: addressId,
      actorId,
    });

    // 1. Staff query (e.g. MANAGER) receives full order with pricing & CRM link
    const managerView = await orderService.getOrder(tenantId, order.id, "MANAGER");
    expect(managerView.total_amount).toBeDefined();
    expect(managerView.customer_id).toBe(customerId);

    // 2. Driver query receives DeliveryViewDTO (contact, gate code, notes) with zero financial or private CRM exposure
    const driverView = await orderService.getOrder(tenantId, order.id, "DRIVER");
    expect(driverView.id).toBe(order.id);
    expect(driverView.orderNumber).toBe(order.order_number);
    expect(driverView.deliveryView).toBeDefined();
    expect(driverView.deliveryView.customerDisplayName).toBe("עומר לוי");
    expect(driverView.deliveryView.deliveryAddress.street).toBe("הארבעה");
    expect(driverView.deliveryView.accessInstructions.gateCode).toBe("4321");
    expect(driverView.deliveryView.deliveryNotes).toBe("להשאיר ליד הדלת");

    // Masked phone e.g. 050-***6655
    expect(driverView.deliveryView.contactPhoneMasked).toContain("***");

    // Confidential financial & customer CRM fields are stripped
    expect(driverView.total_amount).toBeUndefined();
    expect(driverView.subtotal).toBeUndefined();
    expect(driverView.tax_amount).toBeUndefined();
    expect(driverView.customer_id).toBeUndefined();
  });

  it("enforces multi-tenant isolation: Tenant B cannot query or update Tenant A orders", async () => {
    const tenantB = "org-200-pizza-place";

    const orderA = await orderService.createOrder({
      tenantId,
      branchId,
      channel: "WEB",
      orderType: "TAKEAWAY",
      items: [{ productId: prodFriesId, quantity: 1 }],
      actorId,
    });

    // Tenant B cannot retrieve Tenant A order
    const orderB = await orderService.getOrder(tenantB, orderA.id, "MANAGER");
    expect(orderB).toBeNull();

    // Tenant B cannot confirm Tenant A order
    await expect(orderService.confirmOrder(tenantB, orderA.id, "intruder")).rejects.toThrow(
      /order not found/i
    );
  });
});
