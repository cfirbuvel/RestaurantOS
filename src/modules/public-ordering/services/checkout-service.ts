import crypto from "crypto";
import { memoryDb } from "@/core/database/db";
import { orderService } from "@/modules/orders/services/order-service";
import { menuService } from "@/modules/menu/services/menu-service";
import { customerService } from "@/modules/crm/services/customer-service";
import { publicMenuService } from "./public-menu-service";
import {
  Cart,
  CartItem,
  calculateCartTotals,
  validateCartConstraints,
  CartValidationResult,
  SelectedModifier,
} from "../domain/cart";
import { CheckoutRequest, CheckoutResponse } from "../domain/checkout";
import { publicRateLimiter } from "../security/rate-limiter";
import { MeshulamAdapter } from "@/modules/integrations/payments/meshulam-adapter";
import { StripeAdapter } from "@/modules/integrations/payments/stripe-adapter";

interface OrderTrackingSession {
  orderId: string;
  tenantId: string;
  trackingToken: string;
  createdAt: number;
}

export class CheckoutService {
  private trackingTokens: Map<string, OrderTrackingSession> = new Map();
  private meshulamAdapter = new MeshulamAdapter();
  private stripeAdapter = new StripeAdapter();

  /**
   * Recalculates and validates cart items against live database prices
   */
  async validateCart(
    slugOrBranchId: string,
    cart: {
      items: Array<{
        productId: string;
        variantId?: string | null;
        quantity: number;
        selectedModifiers?: SelectedModifier[];
        notes?: string;
      }>;
      orderType: "DELIVERY" | "TAKEAWAY" | "DINE_IN";
      couponCode?: string | null;
      tipAmount?: number;
    }
  ): Promise<{
    isValid: boolean;
    errors: string[];
    cart: Cart;
  }> {
    const context = await publicMenuService.resolveRestaurantContext(slugOrBranchId);
    const restInfo = await publicMenuService.getRestaurantPublicInfo(slugOrBranchId);
    const errors: string[] = [];

    const validatedItems: CartItem[] = [];

    for (const item of cart.items) {
      const product = await menuService.getProduct(context.tenantId, item.productId, context.branchId);

      if (!product || !product.is_active) {
        errors.push(`PRODUCT_UNAVAILABLE: המוצר המבוקש אינו קיים או אינו זמין (${item.productId})`);
        continue;
      }

      let basePrice = Number(product.base_price);

      // Check variant if specified
      if (item.variantId) {
        const variant = (product.variants || []).find((v) => v.id === item.variantId && v.is_active);
        if (variant) {
          basePrice += Number(variant.price_adjustment || 0);
        }
      }

      // Validate and compute server-authoritative modifier prices
      const validatedModifiers: SelectedModifier[] = [];
      const selectedModMap = new Map((item.selectedModifiers || []).map((m) => [m.modifierId, m]));

      for (const group of product.modifier_groups || []) {
        const selectedInGroup: SelectedModifier[] = [];
        for (const mod of group.modifiers || []) {
          if (selectedModMap.has(mod.id)) {
            const priceAdj = Number(mod.price_adjustment || 0);
            selectedInGroup.push({
              modifierId: mod.id,
              name: mod.name,
              priceAdjustment: priceAdj,
            });
            validatedModifiers.push({
              modifierId: mod.id,
              name: mod.name,
              priceAdjustment: priceAdj,
            });
          }
        }

        // Validate min/max selection for required modifier groups
        if (group.is_required && selectedInGroup.length < group.min_selection) {
          errors.push(
            `REQUIRED_MODIFIER_MISSING: חובה לבחור לפחות ${group.min_selection} אפשרויות מקבוצת '${group.name}' עבור '${product.name}'`
          );
        }
        if (group.max_selection && selectedInGroup.length > group.max_selection) {
          errors.push(
            `MAX_MODIFIERS_EXCEEDED: ניתן לבחור לכל היותר ${group.max_selection} אפשרויות מקבוצת '${group.name}'`
          );
        }
      }

      const itemTotal = (basePrice + validatedModifiers.reduce((s, m) => s + (m.priceAdjustment || 0), 0)) * item.quantity;

      validatedItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productId: product.id,
        name: product.name,
        basePrice,
        quantity: item.quantity,
        variantId: item.variantId || null,
        selectedModifiers: validatedModifiers,
        notes: item.notes,
        itemTotal: Number(itemTotal.toFixed(2)),
      });
    }

    // Calculate coupon discount
    let discountAmount = 0;
    if (cart.couponCode) {
      const codeUpper = cart.couponCode.trim().toUpperCase();
      // Built-in standard promotional codes
      if (codeUpper === "WELCOME10" || codeUpper === "SHORTECH10") {
        const rawSubtotal = validatedItems.reduce((acc, it) => acc + it.itemTotal, 0);
        discountAmount = Number((rawSubtotal * 0.1).toFixed(2));
      } else if (codeUpper === "BURGER20" || codeUpper === "VIP20") {
        discountAmount = 20.0;
      } else {
        errors.push("INVALID_COUPON: קוד קופון אינו תקין או פג תוקף");
      }
    }

    const calculatedCart = calculateCartTotals(validatedItems, cart.orderType, {
      deliveryFee: restInfo.deliveryFee,
      discountAmount,
      tipAmount: cart.tipAmount || 0,
      vatRate: 0.17,
    });
    calculatedCart.couponCode = cart.couponCode || null;

    const constraintCheck = validateCartConstraints(calculatedCart, {
      minOrderAmount: restInfo.minOrderAmount,
      maxItemsCount: 50,
      deliveryAvailable: restInfo.features.delivery,
    });

    if (!constraintCheck.isValid) {
      errors.push(...constraintCheck.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      cart: calculatedCart,
    };
  }

  /**
   * Process customer checkout from Web or Kiosk
   */
  async processCheckout(
    slugOrBranchId: string,
    request: CheckoutRequest,
    clientIp: string = "127.0.0.1"
  ): Promise<CheckoutResponse> {
    // 1. Rate limiting check
    const rateCheck = publicRateLimiter.check(`checkout_${clientIp}`, 30, 60000);
    if (!rateCheck.allowed) {
      throw new Error("RATE_LIMIT_EXCEEDED: אנא המתן מספר שניות ונסה שוב");
    }

    const context = await publicMenuService.resolveRestaurantContext(slugOrBranchId);

    // 2. Server-side price recalculation & validation
    const validation = await this.validateCart(slugOrBranchId, {
      items: request.items,
      orderType: request.orderType,
      couponCode: request.couponCode,
      tipAmount: request.tipAmount,
    });

    if (!validation.isValid) {
      throw new Error(`CART_VALIDATION_FAILED: ${validation.errors.join(", ")}`);
    }

    const cart = validation.cart;

    // 3. Guest CRM Customer handling (find existing by phone or create guest profile)
    let customerId: string | null = null;
    try {
      const existingCusts = await customerService.searchCustomers(context.tenantId, request.customer.phone);
      if (existingCusts && existingCusts.length > 0) {
        customerId = existingCusts[0].id;
      } else {
        const nameParts = request.customer.name.trim().split(" ");
        const firstName = nameParts[0] || "Guest";
        const lastName = nameParts.slice(1).join(" ") || "Customer";
        const newCust = await customerService.createCustomer(context.tenantId, {
          phone: request.customer.phone,
          firstName,
          lastName,
          email: request.customer.email || undefined,
        });
        customerId = newCust.id;
      }
    } catch (e) {
      // Non-blocking fallback for guest customer
      customerId = null;
    }

    // 4. Create Universal Order via OrderService
    const orderItemsParam = cart.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId || undefined,
      quantity: it.quantity,
      notes: it.notes,
      selectedModifiers: it.selectedModifiers.map((m) => ({ modifierId: m.modifierId })),
    }));

    const orderNotes = [
      request.notes,
      request.tableNumber ? `שולחן: ${request.tableNumber}` : "",
      request.deliveryAddress?.notes ? `הוראות משלוח: ${request.deliveryAddress.notes}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const createdOrder = await orderService.createOrder({
      tenantId: context.tenantId,
      branchId: context.branchId,
      customerId: customerId,
      channel: request.channel,
      orderType: request.orderType,
      items: orderItemsParam,
      deliveryFee: cart.deliveryFee,
      discountAmount: cart.discountAmount,
      tipAmount: cart.tipAmount,
      notes: orderNotes || undefined,
      actorId: customerId || "public-guest",
      actorType: "USER",
      autoConfirm: request.channel === "KIOSK", // Auto confirm kiosk orders immediately
      metadata: {
        customerName: request.customer.name,
        customerPhone: request.customer.phone,
        customerEmail: request.customer.email,
        deliveryAddress: request.deliveryAddress,
        paymentMethod: request.paymentMethod,
        tableNumber: request.tableNumber,
      },
    });

    // 5. Payment processing
    let paymentStatus: "PAID" | "PENDING" | "PAY_ON_DELIVERY" | "PAY_AT_COUNTER" = "PENDING";
    let paymentRedirectUrl: string | undefined = undefined;

    if (request.paymentMethod === "CREDIT_CARD") {
      // Simulate / process credit card payment via Meshulam or Stripe adapter
      const gateway = request.paymentDetails?.gateway || "MESHULAM";
      if (gateway === "STRIPE") {
        const paymentRes = await this.stripeAdapter.processPayment({
          tenantId: context.tenantId,
          branchId: context.branchId,
          orderId: createdOrder.id,
          provider: "STRIPE",
          amount: cart.totalAmount,
          currency: "ILS",
          paymentMethod: "CREDIT_CARD",
          token: request.paymentDetails?.token || "mock_stripe_tok_web",
          installments: 1,
          capture: true,
          metadata: { channel: request.channel },
        });
        if (paymentRes.status === "PAID" || paymentRes.status === "AUTHORIZED") {
          paymentStatus = "PAID";
        }
      } else {
        // Meshulam default
        const paymentRes = await this.meshulamAdapter.processPayment({
          tenantId: context.tenantId,
          branchId: context.branchId,
          orderId: createdOrder.id,
          provider: "MESHULAM",
          amount: cart.totalAmount,
          currency: "ILS",
          paymentMethod: "CREDIT_CARD",
          token: request.paymentDetails?.token || "mock_meshulam_tok_web",
          installments: 1,
          capture: true,
          metadata: { channel: request.channel },
        });
        if (paymentRes.status === "PAID" || paymentRes.status === "AUTHORIZED") {
          paymentStatus = "PAID";
        }
      }
    } else if (request.paymentMethod === "EMV_TERMINAL") {
      // Mock EMV terminal handshake for Kiosk
      paymentStatus = "PAID";
    } else if (request.paymentMethod === "CASH") {
      paymentStatus = "PAY_ON_DELIVERY";
    } else if (request.paymentMethod === "PAY_AT_COUNTER") {
      paymentStatus = "PAY_AT_COUNTER";
    }

    // 6. Generate order tracking token
    const trackingToken = crypto.randomBytes(16).toString("hex");
    this.trackingTokens.set(createdOrder.id, {
      orderId: createdOrder.id,
      tenantId: context.tenantId,
      trackingToken,
      createdAt: Date.now(),
    });

    const trackingUrl = `/r/${context.slug}/order/${createdOrder.id}?token=${trackingToken}`;

    return {
      success: true,
      orderId: createdOrder.id,
      orderNumber: (createdOrder as any).order_number || createdOrder.id.slice(-6).toUpperCase(),
      trackingToken,
      trackingUrl,
      channel: request.channel,
      status: createdOrder.status,
      totalAmount: cart.totalAmount,
      discountAmount: cart.discountAmount,
      deliveryFee: cart.deliveryFee,
      paymentStatus,
      paymentRedirectUrl,
      message: "ההזמנה התקבלה בהצלחה!",
    };
  }

  /**
   * Get live status and tracking coordinates for an order
   */
  async getOrderStatus(
    slugOrBranchId: string,
    orderId: string,
    token?: string
  ): Promise<{
    orderId: string;
    orderNumber: string;
    status: string;
    channel: string;
    orderType: string;
    createdAt: string;
    estimatedMinutes: number;
    itemsCount: number;
    totalAmount: number;
    deliveryAddress?: any;
    driverLocation?: {
      lat: number;
      lng: number;
      heading: number;
      speedKmh: number;
      driverName: string;
      driverPhone: string;
    } | null;
  } | null> {
    const context = await publicMenuService.resolveRestaurantContext(slugOrBranchId);
    const order = await orderService.getOrder(context.tenantId, orderId);

    if (!order) {
      return null;
    }

    // Simulated driver location progression for delivery orders in transit
    let driverLocation = null;
    if (order.order_type === "DELIVERY" && ["PREPARING", "READY", "IN_TRANSIT"].includes(order.status)) {
      // Tel Aviv center coordinates simulation
      const baseLat = 32.0662;
      const baseLng = 34.7778;
      // Slight progression offset based on time
      const timeOffset = (Date.now() / 10000) % 0.01;

      driverLocation = {
        lat: Number((baseLat + timeOffset).toFixed(6)),
        lng: Number((baseLng + timeOffset).toFixed(6)),
        heading: 45,
        speedKmh: order.status === "IN_TRANSIT" ? 32 : 0,
        driverName: "יוסי לוי (שליח)",
        driverPhone: "052-7654321",
      };
    }

    return {
      orderId: order.id,
      orderNumber: (order as any).order_number || order.id.slice(-6).toUpperCase(),
      status: order.status,
      channel: order.channel,
      orderType: order.order_type,
      createdAt: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString(),
      estimatedMinutes: order.order_type === "DELIVERY" ? 30 : 15,
      itemsCount: (order.items || []).length,
      totalAmount: Number(order.total_amount),
      deliveryAddress: (order.metadata as any)?.deliveryAddress,
      driverLocation,
    };
  }
}

export const checkoutService = new CheckoutService();
