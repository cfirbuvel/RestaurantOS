import type { Coupon, CouponRedemption, CouponValidationContext } from "../domain/marketing";
import { createCouponSchema, validateCoupon } from "../domain/marketing";

// ============================================================================
// Phase 6: Coupon Service
// ============================================================================

export class CouponService {
  private coupons: Map<string, Coupon> = new Map();
  private redemptions: CouponRedemption[] = [];

  /**
   * Create a new coupon with validation.
   */
  createCoupon(tenantId: string, input: Record<string, any>, createdBy?: string): Coupon {
    const parsed = createCouponSchema.parse(input);

    // Check for duplicate coupon code within tenant
    const existing = this.findCouponByCode(tenantId, parsed.code);
    if (existing) {
      throw new Error("COUPON_CODE_ALREADY_EXISTS");
    }

    const coupon: Coupon = {
      id: `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      campaign_id: parsed.campaignId ?? null,
      code: parsed.code.toUpperCase(),
      scope: parsed.scope,
      status: "ACTIVE",
      discount_type: parsed.discountType,
      discount_value: parsed.discountValue,
      max_discount_amount: parsed.maxDiscountAmount ?? null,
      min_order_amount: parsed.minOrderAmount ?? null,
      customer_id: parsed.customerId ?? null,
      activation_date: parsed.activationDate ?? null,
      expiration_date: parsed.expirationDate ?? null,
      usage_limit_global: parsed.usageLimitGlobal ?? null,
      usage_limit_per_customer: parsed.usageLimitPerCustomer ?? null,
      usage_count: 0,
      branch_restriction: parsed.branchRestriction ?? null,
      channel_restriction: parsed.channelRestriction ?? null,
      created_by: createdBy ?? null,
      created_at: new Date(),
      updated_at: new Date(),
      version: 1,
    };

    this.coupons.set(coupon.id, coupon);
    return coupon;
  }

  /**
   * Find a coupon by code within a tenant (case-insensitive).
   */
  findCouponByCode(tenantId: string, code: string): Coupon | null {
    const upper = code.toUpperCase();
    for (const coupon of this.coupons.values()) {
      if (coupon.tenant_id === tenantId && coupon.code === upper) {
        return coupon;
      }
    }
    return null;
  }

  /**
   * Get a coupon by ID with tenant guard.
   */
  getCoupon(tenantId: string, couponId: string): Coupon | null {
    const coupon = this.coupons.get(couponId);
    if (!coupon || coupon.tenant_id !== tenantId) {
      return null;
    }
    return coupon;
  }

  /**
   * List coupons with optional campaign filter and pagination.
   */
  listCoupons(
    tenantId: string,
    filters?: { campaignId?: string; status?: string; page?: number; limit?: number }
  ): { data: Coupon[]; total: number; page: number; limit: number } {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    let results = Array.from(this.coupons.values()).filter(
      (c) => c.tenant_id === tenantId
    );

    if (filters?.campaignId) {
      results = results.filter((c) => c.campaign_id === filters.campaignId);
    }
    if (filters?.status) {
      results = results.filter((c) => c.status === filters.status);
    }

    const total = results.length;
    const offset = (page - 1) * limit;
    const data = results.slice(offset, offset + limit);

    return { data, total, page, limit };
  }

  /**
   * Validate a coupon code against order context.
   * Returns validation result with calculated discount if valid.
   */
  validateCouponCode(
    tenantId: string,
    code: string,
    customerId: string | null,
    orderSubtotal: number,
    branchId: string,
    channel: string,
    now?: Date
  ): { valid: boolean; errorCode?: string; errorMessage?: string; calculatedDiscount?: number; coupon?: Coupon } {
    const coupon = this.findCouponByCode(tenantId, code);
    if (!coupon) {
      return { valid: false, errorCode: "COUPON_NOT_FOUND", errorMessage: "Invalid coupon code" };
    }

    const customerRedemptionCount = customerId
      ? this.getCustomerRedemptionCount(coupon.id, customerId)
      : 0;

    const ctx: CouponValidationContext = {
      coupon,
      customerId,
      orderSubtotal,
      branchId,
      channel,
      customerRedemptionCount,
      now,
    };

    const result = validateCoupon(ctx);
    return { ...result, coupon: result.valid ? coupon : undefined };
  }

  /**
   * Redeem a coupon on an order. Atomically increments usage count.
   * Returns the redemption record.
   */
  redeemCoupon(
    tenantId: string,
    couponCode: string,
    customerId: string,
    orderId: string,
    orderSubtotal: number,
    branchId: string,
    channel: string
  ): CouponRedemption {
    // Validate first
    const validation = this.validateCouponCode(
      tenantId,
      couponCode,
      customerId,
      orderSubtotal,
      branchId,
      channel
    );

    if (!validation.valid || !validation.coupon) {
      throw new Error(validation.errorCode ?? "COUPON_VALIDATION_FAILED");
    }

    const coupon = validation.coupon;
    const discountApplied = validation.calculatedDiscount ?? 0;

    // Atomic increment of usage count (optimistic locking pattern)
    const updatedCoupon = { ...coupon };
    updatedCoupon.usage_count += 1;
    updatedCoupon.updated_at = new Date();
    updatedCoupon.version += 1;

    // Check if exhausted after this redemption
    if (
      updatedCoupon.usage_limit_global != null &&
      updatedCoupon.usage_count >= updatedCoupon.usage_limit_global
    ) {
      updatedCoupon.status = "EXHAUSTED";
    }

    this.coupons.set(coupon.id, updatedCoupon);

    // Record redemption
    const redemption: CouponRedemption = {
      id: `red_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      coupon_id: coupon.id,
      customer_id: customerId,
      order_id: orderId,
      discount_applied: discountApplied,
      rolled_back: false,
      redeemed_at: new Date(),
    };

    this.redemptions.push(redemption);
    return redemption;
  }

  /**
   * Rollback a coupon redemption (e.g., on order cancellation or refund).
   * Decrements usage count and marks redemption as rolled back.
   */
  rollbackRedemption(tenantId: string, orderId: string): CouponRedemption | null {
    const redemption = this.redemptions.find(
      (r) => r.tenant_id === tenantId && r.order_id === orderId && !r.rolled_back
    );

    if (!redemption) {
      return null;
    }

    // Mark as rolled back
    redemption.rolled_back = true;

    // Decrement usage count on the coupon
    const coupon = this.coupons.get(redemption.coupon_id);
    if (coupon) {
      const updated = { ...coupon };
      updated.usage_count = Math.max(0, updated.usage_count - 1);
      // Re-activate if it was exhausted
      if (updated.status === "EXHAUSTED") {
        updated.status = "ACTIVE";
      }
      updated.updated_at = new Date();
      updated.version += 1;
      this.coupons.set(coupon.id, updated);
    }

    return redemption;
  }

  /**
   * Deactivate a coupon (soft disable).
   */
  deactivateCoupon(tenantId: string, couponId: string): Coupon {
    const coupon = this.getCoupon(tenantId, couponId);
    if (!coupon) {
      throw new Error("COUPON_NOT_FOUND");
    }

    const updated: Coupon = {
      ...coupon,
      status: "DISABLED",
      updated_at: new Date(),
      version: coupon.version + 1,
    };

    this.coupons.set(couponId, updated);
    return updated;
  }

  /**
   * Generate bulk unique coupon codes for a campaign.
   */
  generateBulkCoupons(
    tenantId: string,
    campaignId: string,
    count: number,
    template: Omit<Record<string, any>, "code" | "campaignId">,
    createdBy?: string
  ): Coupon[] {
    const coupons: Coupon[] = [];

    for (let i = 0; i < count; i++) {
      const code = this.generateUniqueCode(tenantId);
      const coupon = this.createCoupon(
        tenantId,
        { ...template, code, campaignId, scope: "UNIQUE" },
        createdBy
      );
      coupons.push(coupon);
    }

    return coupons;
  }

  /**
   * Get number of times a customer has redeemed a specific coupon.
   */
  getCustomerRedemptionCount(couponId: string, customerId: string): number {
    return this.redemptions.filter(
      (r) =>
        r.coupon_id === couponId &&
        r.customer_id === customerId &&
        !r.rolled_back
    ).length;
  }

  /**
   * Get all redemptions for an order.
   */
  getOrderRedemptions(tenantId: string, orderId: string): CouponRedemption[] {
    return this.redemptions.filter(
      (r) => r.tenant_id === tenantId && r.order_id === orderId && !r.rolled_back
    );
  }

  /**
   * Generate a unique alphanumeric coupon code.
   */
  private generateUniqueCode(tenantId: string): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code: string;
    let attempts = 0;

    do {
      code = Array.from({ length: 8 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
      attempts++;
      if (attempts > 100) {
        throw new Error("COUPON_CODE_GENERATION_FAILED");
      }
    } while (this.findCouponByCode(tenantId, code) !== null);

    return code;
  }

  /** Test helper: inject coupon directly */
  _injectCoupon(coupon: Coupon): void {
    this.coupons.set(coupon.id, coupon);
  }

  /** Test helper: inject redemption directly */
  _injectRedemption(redemption: CouponRedemption): void {
    this.redemptions.push(redemption);
  }
}
