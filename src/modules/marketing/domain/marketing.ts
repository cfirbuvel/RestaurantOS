import { z } from "zod";

// ============================================================================
// Phase 6: Campaigns, Promotions, Coupons & Loyalty Enums
// ============================================================================

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

export type CampaignType =
  | "PROMOTIONAL"
  | "SEASONAL"
  | "LOYALTY_REWARD"
  | "FLASH_SALE"
  | "FIRST_ORDER"
  | "ONE_TIME_COUPON"
  | "RETURNING_CUSTOMER"
  | "BIRTHDAY"
  | "WIN_BACK"
  | "VIP"
  | "REFERRAL"
  | "FREE_DELIVERY"
  | "PERCENTAGE_DISCOUNT"
  | "FIXED_DISCOUNT"
  | "FREE_ITEM"
  | "BOGO"
  | "PRODUCT_SPECIFIC"
  | "CATEGORY_SPECIFIC"
  | "BRANCH_SPECIFIC"
  | "CHANNEL_SPECIFIC"
  | "DELIVERY_ZONE_SPECIFIC";

export type CouponScope = "UNIQUE" | "REUSABLE" | "ONE_TIME" | "CUSTOMER_SPECIFIC";

export type CouponStatus = "ACTIVE" | "EXPIRED" | "EXHAUSTED" | "DISABLED";

export type DiscountType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "FREE_ITEM"
  | "FREE_DELIVERY"
  | "BOGO";

export type PromotionStackMode = "STACKABLE" | "EXCLUSIVE" | "BEST_DEAL";

/**
 * Loyalty tiers — 3-tier model per business requirements:
 * - NEW_CUSTOMER (לקוח חדש) — default tier for new customers
 * - REGULAR (לקוח קבוע) — loyal returning customers
 * - VIP (לקוח VIP) — premium tier
 */
export type LoyaltyTier = "NEW_CUSTOMER" | "REGULAR" | "VIP";

export type LoyaltyTransactionType =
  | "EARN"
  | "REDEEM"
  | "EXPIRE"
  | "ADJUSTMENT"
  | "BONUS";

export type SegmentOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL"
  | "BETWEEN"
  | "IN"
  | "NOT_IN";

// ============================================================================
// Phase 6: Domain Interfaces
// ============================================================================

export interface Campaign {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  name: string;
  description?: string | null;
  type: CampaignType;
  status: CampaignStatus;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  starts_at?: Date | string | null;
  ends_at?: Date | string | null;
  usage_limit?: number | null;
  budget_limit?: number | null;
  usage_count: number;
  priority: number;
  stack_mode: PromotionStackMode;
  target_segment_id?: string | null;
  channel_restriction?: string[] | null;
  zone_restriction?: string[] | null;
  product_restriction?: string[] | null;
  category_restriction?: string[] | null;
  birthday_window_days_before: number;
  birthday_window_days_after: number;
  metadata?: Record<string, any>;
  created_by?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
  version: number;
}

export interface Coupon {
  id: string;
  tenant_id: string;
  campaign_id?: string | null;
  code: string;
  scope: CouponScope;
  status: CouponStatus;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  customer_id?: string | null;
  activation_date?: Date | string | null;
  expiration_date?: Date | string | null;
  usage_limit_global?: number | null;
  usage_limit_per_customer?: number | null;
  usage_count: number;
  branch_restriction?: string[] | null;
  channel_restriction?: string[] | null;
  created_by?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  version: number;
}

export interface CouponRedemption {
  id: string;
  tenant_id: string;
  coupon_id: string;
  customer_id: string;
  order_id: string;
  discount_applied: number;
  rolled_back: boolean;
  redeemed_at: Date | string;
}

export interface Promotion {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  name: string;
  description?: string | null;
  is_active: boolean;
  conditions: PromotionRule[];
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  priority: number;
  stack_mode: PromotionStackMode;
  starts_at?: Date | string | null;
  ends_at?: Date | string | null;
  channel_restriction?: string[] | null;
  product_restriction?: string[] | null;
  category_restriction?: string[] | null;
  usage_limit?: number | null;
  usage_count: number;
  created_by?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at?: Date | string | null;
  version: number;
}

export interface PromotionRule {
  field: string;
  operator: SegmentOperator;
  value: string | number | boolean | string[] | number[];
}

/**
 * Order context used by the promotion engine to evaluate rules.
 * Constructed at order-time from the order + CRM customer profile.
 */
export interface PromotionOrderContext {
  tenantId: string;
  branchId: string;
  channel: string;
  orderType: string;
  customerId?: string | null;
  customerProfile?: {
    isFirstOrder: boolean;
    totalOrdersCount: number;
    totalSpentAmount: number;
    lastOrderAt?: Date | string | null;
    daysSinceLastOrder?: number | null;
    isVip: boolean;
    isBirthday: boolean;
    loyaltyTier?: LoyaltyTier | null;
  } | null;
  items: PromotionOrderItem[];
  subtotal: number;
  couponCode?: string | null;
}

export interface PromotionOrderItem {
  productId: string;
  categoryId?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface AppliedPromotion {
  promotionId: string;
  promotionName: string;
  discountType: DiscountType;
  discountValue: number;
  calculatedDiscount: number;
  stackMode: PromotionStackMode;
  priority: number;
  explanation: string;
}

export interface PromotionEvaluationResult {
  appliedPromotions: AppliedPromotion[];
  totalDiscount: number;
  explanations: string[];
}

export interface LoyaltyProgram {
  id: string;
  tenant_id: string;
  name: string;
  points_display_name: string;
  points_per_currency_unit: number;
  currency_per_point: number;
  regular_threshold: number;
  vip_threshold: number;
  points_expiry_days?: number | null;
  birthday_window_days_before: number;
  birthday_window_days_after: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  version: number;
}

export interface LoyaltyAccount {
  id: string;
  tenant_id: string;
  customer_id: string;
  current_points: number;
  lifetime_points: number;
  current_tier: LoyaltyTier;
  tier_updated_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  version: number;
}

export interface LoyaltyTransaction {
  id: string;
  tenant_id: string;
  account_id: string;
  type: LoyaltyTransactionType;
  points: number;
  balance_after: number;
  order_id?: string | null;
  description?: string | null;
  expires_at?: Date | string | null;
  created_at: Date | string;
}

export interface CustomerSegment {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  conditions: PromotionRule[];
  is_active: boolean;
  created_by?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  version: number;
}

export interface CampaignDispatch {
  id: string;
  tenant_id: string;
  campaign_id: string;
  customer_id: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED";
  sent_at?: Date | string | null;
  error?: string | null;
  created_at: Date | string;
}

export interface ReferralCode {
  id: string;
  tenant_id: string;
  customer_id: string;
  campaign_id: string;
  code: string;
  usage_count: number;
  max_uses?: number | null;
  reward_points: number;
  is_active: boolean;
  created_at: Date | string;
}

// ============================================================================
// Phase 6: State Machines
// ============================================================================

/**
 * Campaign lifecycle state machine.
 */
export const VALID_CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["SCHEDULED", "ACTIVE", "CANCELLED"],
  SCHEDULED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionCampaign(
  current: CampaignStatus,
  target: CampaignStatus
): boolean {
  return VALID_CAMPAIGN_TRANSITIONS[current]?.includes(target) ?? false;
}

// ============================================================================
// Phase 6: Loyalty Tier Calculation
// ============================================================================

export const LOYALTY_TIER_LABELS: Record<LoyaltyTier, string> = {
  NEW_CUSTOMER: "לקוח חדש",
  REGULAR: "לקוח קבוע",
  VIP: "לקוח VIP",
};

/**
 * Deterministic tier calculation based on lifetime points and program thresholds.
 */
export function calculateLoyaltyTier(
  lifetimePoints: number,
  program: Pick<LoyaltyProgram, "regular_threshold" | "vip_threshold">
): LoyaltyTier {
  if (lifetimePoints >= program.vip_threshold) return "VIP";
  if (lifetimePoints >= program.regular_threshold) return "REGULAR";
  return "NEW_CUSTOMER";
}

// ============================================================================
// Phase 6: First Order Logic
// ============================================================================

/**
 * Determines whether a customer qualifies for first-order promotions.
 * A "first order" is defined as the customer's first COMPLETED order.
 *
 * Orders that are CANCELLED, FAILED, or still in processing do NOT count.
 * Only verified completions qualify as legitimate orders.
 */
export function isFirstOrderEligible(completedOrdersCount: number): boolean {
  return completedOrdersCount === 0;
}

// ============================================================================
// Phase 6: Discount Calculation Helpers
// ============================================================================

/**
 * Calculates the effective discount amount based on type and value.
 * Respects the max_discount_amount cap when set.
 */
export function calculateDiscountAmount(
  discountType: DiscountType,
  discountValue: number,
  subtotal: number,
  maxDiscountAmount?: number | null,
  itemPrice?: number | null
): number {
  let discount = 0;

  switch (discountType) {
    case "PERCENTAGE":
      discount = subtotal * (discountValue / 100);
      break;
    case "FIXED_AMOUNT":
      discount = discountValue;
      break;
    case "FREE_DELIVERY":
      // Delivery fee discount handled at order level, return 0 here
      discount = 0;
      break;
    case "FREE_ITEM":
      discount = itemPrice ?? 0;
      break;
    case "BOGO":
      // Buy One Get One: discount = price of cheapest qualifying item
      discount = itemPrice ?? 0;
      break;
    default:
      discount = 0;
  }

  // Ensure discount doesn't exceed subtotal
  discount = Math.min(discount, subtotal);

  // Apply max discount cap
  if (maxDiscountAmount != null && maxDiscountAmount > 0) {
    discount = Math.min(discount, maxDiscountAmount);
  }

  // Round to 2 decimal places
  return Math.round(discount * 100) / 100;
}

// ============================================================================
// Phase 6: Coupon Validation Helpers
// ============================================================================

export interface CouponValidationContext {
  coupon: Coupon;
  customerId?: string | null;
  orderSubtotal: number;
  branchId: string;
  channel: string;
  customerRedemptionCount: number;
  now?: Date;
}

export interface CouponValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  calculatedDiscount?: number;
}

/**
 * Comprehensive coupon validation — checks all constraints.
 */
export function validateCoupon(ctx: CouponValidationContext): CouponValidationResult {
  const { coupon, customerId, orderSubtotal, branchId, channel, customerRedemptionCount } = ctx;
  const now = ctx.now ?? new Date();

  // Status check
  if (coupon.status !== "ACTIVE") {
    if (coupon.status === "EXHAUSTED") {
      return { valid: false, errorCode: "COUPON_EXHAUSTED", errorMessage: "Coupon usage limit reached" };
    }
    if (coupon.status === "EXPIRED") {
      return { valid: false, errorCode: "COUPON_EXPIRED", errorMessage: "Coupon has expired" };
    }
    return { valid: false, errorCode: "COUPON_INACTIVE", errorMessage: `Coupon is ${coupon.status.toLowerCase()}` };
  }

  // Activation date check
  if (coupon.activation_date && new Date(coupon.activation_date) > now) {
    return { valid: false, errorCode: "COUPON_NOT_YET_ACTIVE", errorMessage: "Coupon is not yet active" };
  }

  // Expiration check
  if (coupon.expiration_date && new Date(coupon.expiration_date) < now) {
    return { valid: false, errorCode: "COUPON_EXPIRED", errorMessage: "Coupon has expired" };
  }

  // Global usage limit
  if (coupon.usage_limit_global != null && coupon.usage_count >= coupon.usage_limit_global) {
    return { valid: false, errorCode: "COUPON_EXHAUSTED", errorMessage: "Coupon usage limit reached" };
  }

  // Per-customer usage limit
  if (coupon.usage_limit_per_customer != null && customerRedemptionCount >= coupon.usage_limit_per_customer) {
    return { valid: false, errorCode: "COUPON_CUSTOMER_LIMIT", errorMessage: "You have already used this coupon the maximum number of times" };
  }

  // Customer-specific check
  if (coupon.scope === "CUSTOMER_SPECIFIC" && coupon.customer_id && coupon.customer_id !== customerId) {
    return { valid: false, errorCode: "COUPON_NOT_FOR_CUSTOMER", errorMessage: "This coupon is not valid for your account" };
  }

  // Minimum order amount
  if (coupon.min_order_amount != null && orderSubtotal < coupon.min_order_amount) {
    return {
      valid: false,
      errorCode: "COUPON_MIN_ORDER_NOT_MET",
      errorMessage: `Minimum order amount of ${coupon.min_order_amount} required`,
    };
  }

  // Branch restriction
  if (coupon.branch_restriction && coupon.branch_restriction.length > 0) {
    if (!coupon.branch_restriction.includes(branchId)) {
      return { valid: false, errorCode: "COUPON_BRANCH_RESTRICTED", errorMessage: "Coupon is not valid for this branch" };
    }
  }

  // Channel restriction
  if (coupon.channel_restriction && coupon.channel_restriction.length > 0) {
    if (!coupon.channel_restriction.includes(channel)) {
      return { valid: false, errorCode: "COUPON_CHANNEL_RESTRICTED", errorMessage: "Coupon is not valid for this order channel" };
    }
  }

  // Calculate discount
  const calculatedDiscount = calculateDiscountAmount(
    coupon.discount_type,
    coupon.discount_value,
    orderSubtotal,
    coupon.max_discount_amount
  );

  return { valid: true, calculatedDiscount };
}

// ============================================================================
// Phase 6: Zod Schemas
// ============================================================================

const campaignTypeEnum = z.enum([
  "PROMOTIONAL", "SEASONAL", "LOYALTY_REWARD", "FLASH_SALE",
  "FIRST_ORDER", "ONE_TIME_COUPON", "RETURNING_CUSTOMER", "BIRTHDAY",
  "WIN_BACK", "VIP", "REFERRAL", "FREE_DELIVERY", "PERCENTAGE_DISCOUNT",
  "FIXED_DISCOUNT", "FREE_ITEM", "BOGO", "PRODUCT_SPECIFIC",
  "CATEGORY_SPECIFIC", "BRANCH_SPECIFIC", "CHANNEL_SPECIFIC",
  "DELIVERY_ZONE_SPECIFIC",
]);

const discountTypeEnum = z.enum([
  "PERCENTAGE", "FIXED_AMOUNT", "FREE_ITEM", "FREE_DELIVERY", "BOGO",
]);

const stackModeEnum = z.enum(["STACKABLE", "EXCLUSIVE", "BEST_DEAL"]);

const couponScopeEnum = z.enum(["UNIQUE", "REUSABLE", "ONE_TIME", "CUSTOMER_SPECIFIC"]);

const segmentOperatorEnum = z.enum([
  "EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN",
  "GREATER_THAN_OR_EQUAL", "LESS_THAN_OR_EQUAL", "BETWEEN", "IN", "NOT_IN",
]);

const promotionRuleSchema = z.object({
  field: z.string().min(1),
  operator: segmentOperatorEnum,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
});

export const createCampaignSchema = z.object({
  branchId: z.string().optional().nullable(),
  name: z.string().min(1, "Campaign name is required").max(255),
  description: z.string().optional().nullable(),
  type: campaignTypeEnum,
  discountType: discountTypeEnum.optional().nullable(),
  discountValue: z.number().min(0).optional().nullable(),
  maxDiscountAmount: z.number().min(0).optional().nullable(),
  minOrderAmount: z.number().min(0).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  budgetLimit: z.number().min(0).optional().nullable(),
  priority: z.number().int().min(0).default(0),
  stackMode: stackModeEnum.default("EXCLUSIVE"),
  targetSegmentId: z.string().optional().nullable(),
  channelRestriction: z.array(z.string()).optional().nullable(),
  zoneRestriction: z.array(z.string()).optional().nullable(),
  productRestriction: z.array(z.string()).optional().nullable(),
  categoryRestriction: z.array(z.string()).optional().nullable(),
  birthdayWindowDaysBefore: z.number().int().min(0).default(7),
  birthdayWindowDaysAfter: z.number().int().min(0).default(7),
  metadata: z.record(z.any()).optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const createCouponSchema = z.object({
  campaignId: z.string().optional().nullable(),
  code: z.string().min(3, "Coupon code must be at least 3 characters").max(50)
    .regex(/^[A-Z0-9_-]+$/i, "Coupon code must be alphanumeric"),
  scope: couponScopeEnum.default("REUSABLE"),
  discountType: discountTypeEnum,
  discountValue: z.number().positive("Discount value must be positive"),
  maxDiscountAmount: z.number().min(0).optional().nullable(),
  minOrderAmount: z.number().min(0).optional().nullable(),
  customerId: z.string().optional().nullable(),
  activationDate: z.string().datetime().optional().nullable(),
  expirationDate: z.string().datetime().optional().nullable(),
  usageLimitGlobal: z.number().int().positive().optional().nullable(),
  usageLimitPerCustomer: z.number().int().positive().optional().nullable(),
  branchRestriction: z.array(z.string()).optional().nullable(),
  channelRestriction: z.array(z.string()).optional().nullable(),
});

export const redeemCouponSchema = z.object({
  couponCode: z.string().min(1, "Coupon code is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  orderId: z.string().min(1, "Order ID is required"),
  orderSubtotal: z.number().min(0),
  branchId: z.string().min(1),
  channel: z.string().min(1),
});

export const createPromotionSchema = z.object({
  branchId: z.string().optional().nullable(),
  name: z.string().min(1, "Promotion name is required").max(255),
  description: z.string().optional().nullable(),
  conditions: z.array(promotionRuleSchema).min(1, "At least one condition is required"),
  discountType: discountTypeEnum,
  discountValue: z.number().positive("Discount value must be positive"),
  maxDiscountAmount: z.number().min(0).optional().nullable(),
  minOrderAmount: z.number().min(0).optional().nullable(),
  priority: z.number().int().min(0).default(0),
  stackMode: stackModeEnum.default("EXCLUSIVE"),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  channelRestriction: z.array(z.string()).optional().nullable(),
  productRestriction: z.array(z.string()).optional().nullable(),
  categoryRestriction: z.array(z.string()).optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
});

export const updatePromotionSchema = createPromotionSchema.partial();

export const evaluatePromotionsSchema = z.object({
  branchId: z.string().min(1),
  channel: z.string().min(1),
  orderType: z.string().min(1),
  customerId: z.string().optional().nullable(),
  customerProfile: z.object({
    isFirstOrder: z.boolean().default(false),
    totalOrdersCount: z.number().default(0),
    totalSpentAmount: z.number().default(0),
    lastOrderAt: z.string().or(z.date()).optional().nullable(),
    daysSinceLastOrder: z.number().optional().nullable(),
    isVip: z.boolean().default(false),
    isBirthday: z.boolean().default(false),
    loyaltyTier: z.enum(["NEW_CUSTOMER", "REGULAR", "VIP"]).optional().nullable(),
  }).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().min(1),
    categoryId: z.string().optional().nullable(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().min(0),
  })).min(1),
  subtotal: z.number().min(0),
  couponCode: z.string().optional().nullable(),
});

export const createLoyaltyProgramSchema = z.object({
  name: z.string().min(1).max(255).default("Loyalty Program"),
  pointsDisplayName: z.string().min(1).max(50).default("points"),
  pointsPerCurrencyUnit: z.number().positive().default(1.0),
  currencyPerPoint: z.number().positive().default(0.10),
  regularThreshold: z.number().int().min(0).default(500),
  vipThreshold: z.number().int().min(0).default(2000),
  pointsExpiryDays: z.number().int().positive().optional().nullable(),
  birthdayWindowDaysBefore: z.number().int().min(0).default(7),
  birthdayWindowDaysAfter: z.number().int().min(0).default(7),
});

export const updateLoyaltyProgramSchema = createLoyaltyProgramSchema.partial();

export const redeemPointsSchema = z.object({
  points: z.number().int().positive("Must redeem at least 1 point"),
  orderId: z.string().optional().nullable(),
  description: z.string().optional(),
});

export const createSegmentSchema = z.object({
  name: z.string().min(1, "Segment name is required").max(255),
  description: z.string().optional().nullable(),
  conditions: z.array(promotionRuleSchema).min(1, "At least one condition is required"),
});

export const updateSegmentSchema = createSegmentSchema.partial();

// ============================================================================
// Phase 6: Future AI Scaffolding (Gen 2+ — NOT implemented in Gen 1)
// ============================================================================

/**
 * Campaign recommendation engine — suggests campaigns based on customer segments.
 * Gen 1: Not implemented. Gen 2+: ML-driven suggestions.
 */
export interface ICampaignRecommendationEngine {
  suggestCampaign(segment: CustomerSegment): Promise<{ type: CampaignType; confidence: number }>;
}

/**
 * Customer churn prediction engine — predicts likelihood of customer attrition.
 * Gen 1: Not implemented. Gen 2+: ML-driven prediction.
 */
export interface IChurnPredictionEngine {
  predictChurn(customerId: string, tenantId: string): Promise<{ churnProbability: number; riskLevel: "LOW" | "MEDIUM" | "HIGH" }>;
}

/**
 * Next best offer engine — recommends optimal promotion for a specific customer.
 * Gen 1: Not implemented. Gen 2+: Personalized ML-driven offer selection.
 */
export interface INextBestOfferEngine {
  recommendOffer(customerId: string, context: PromotionOrderContext): Promise<{ promotionId: string; score: number }>;
}

/**
 * Campaign optimization engine — optimizes campaign parameters for maximum ROI.
 * Gen 1: Not implemented. Gen 2+: A/B testing and ML-driven optimization.
 */
export interface ICampaignOptimizationEngine {
  optimizeCampaign(campaignId: string): Promise<{ suggestions: string[]; expectedLift: number }>;
}

// ============================================================================
// Phase 6: Campaign Dispatcher Interface (Pluggable — wired in Phase 8)
// ============================================================================

/**
 * Multi-channel campaign dispatcher abstraction.
 * Gen 1: MockCampaignDispatcher for dev/testing.
 * Phase 8: Twilio SMS/WhatsApp, SendGrid Email adapters.
 */
export interface ICampaignDispatcher {
  sendSMS(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string }>;
  sendWhatsApp(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string }>;
  sendEmail(email: string, subject: string, htmlBody: string): Promise<{ success: boolean; messageId?: string }>;
}
