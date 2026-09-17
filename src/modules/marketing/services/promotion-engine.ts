import type {
  Promotion,
  PromotionOrderContext,
  PromotionRule,
  AppliedPromotion,
  PromotionEvaluationResult,
  SegmentOperator,
} from "../domain/marketing";
import { calculateDiscountAmount, createPromotionSchema, updatePromotionSchema } from "../domain/marketing";

// ============================================================================
// Phase 6: Promotion Engine — Deterministic Rule Engine
// ============================================================================

export class PromotionEngine {
  private promotions: Map<string, Promotion> = new Map();

  /**
   * Create a new promotion rule.
   */
  createPromotion(tenantId: string, input: Record<string, any>, createdBy?: string): Promotion {
    const parsed = createPromotionSchema.parse(input);

    const promotion: Promotion = {
      id: `prm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      branch_id: parsed.branchId ?? null,
      name: parsed.name,
      description: parsed.description ?? null,
      is_active: true,
      conditions: parsed.conditions as PromotionRule[],
      discount_type: parsed.discountType,
      discount_value: parsed.discountValue,
      max_discount_amount: parsed.maxDiscountAmount ?? null,
      min_order_amount: parsed.minOrderAmount ?? null,
      priority: parsed.priority,
      stack_mode: parsed.stackMode,
      starts_at: parsed.startsAt ?? null,
      ends_at: parsed.endsAt ?? null,
      channel_restriction: parsed.channelRestriction ?? null,
      product_restriction: parsed.productRestriction ?? null,
      category_restriction: parsed.categoryRestriction ?? null,
      usage_limit: parsed.usageLimit ?? null,
      usage_count: 0,
      created_by: createdBy ?? null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      version: 1,
    };

    this.promotions.set(promotion.id, promotion);
    return promotion;
  }

  /**
   * Update an existing promotion.
   */
  updatePromotion(tenantId: string, promotionId: string, input: Record<string, any>): Promotion {
    const promotion = this.getPromotion(tenantId, promotionId);
    if (!promotion) {
      throw new Error("PROMOTION_NOT_FOUND");
    }

    const parsed = updatePromotionSchema.parse(input);

    const updated: Promotion = {
      ...promotion,
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.conditions !== undefined && { conditions: parsed.conditions as PromotionRule[] }),
      ...(parsed.discountType !== undefined && { discount_type: parsed.discountType }),
      ...(parsed.discountValue !== undefined && { discount_value: parsed.discountValue }),
      ...(parsed.maxDiscountAmount !== undefined && { max_discount_amount: parsed.maxDiscountAmount }),
      ...(parsed.minOrderAmount !== undefined && { min_order_amount: parsed.minOrderAmount }),
      ...(parsed.priority !== undefined && { priority: parsed.priority }),
      ...(parsed.stackMode !== undefined && { stack_mode: parsed.stackMode }),
      ...(parsed.startsAt !== undefined && { starts_at: parsed.startsAt }),
      ...(parsed.endsAt !== undefined && { ends_at: parsed.endsAt }),
      ...(parsed.channelRestriction !== undefined && { channel_restriction: parsed.channelRestriction }),
      ...(parsed.productRestriction !== undefined && { product_restriction: parsed.productRestriction }),
      ...(parsed.categoryRestriction !== undefined && { category_restriction: parsed.categoryRestriction }),
      ...(parsed.usageLimit !== undefined && { usage_limit: parsed.usageLimit }),
      updated_at: new Date(),
      version: promotion.version + 1,
    };

    this.promotions.set(promotionId, updated);
    return updated;
  }

  /**
   * Get a single promotion with tenant guard.
   */
  getPromotion(tenantId: string, promotionId: string): Promotion | null {
    const promotion = this.promotions.get(promotionId);
    if (!promotion || promotion.tenant_id !== tenantId || promotion.deleted_at) {
      return null;
    }
    return promotion;
  }

  /**
   * List promotions with pagination.
   */
  listPromotions(
    tenantId: string,
    filters?: { branchId?: string; isActive?: boolean; page?: number; limit?: number }
  ): { data: Promotion[]; total: number; page: number; limit: number } {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    let results = Array.from(this.promotions.values()).filter(
      (p) => p.tenant_id === tenantId && !p.deleted_at
    );

    if (filters?.branchId) {
      results = results.filter((p) => p.branch_id === filters.branchId || !p.branch_id);
    }
    if (filters?.isActive !== undefined) {
      results = results.filter((p) => p.is_active === filters.isActive);
    }

    const total = results.length;
    const offset = (page - 1) * limit;
    const data = results.slice(offset, offset + limit);

    return { data, total, page, limit };
  }

  /**
   * Soft-delete a promotion.
   */
  deletePromotion(tenantId: string, promotionId: string): void {
    const promotion = this.getPromotion(tenantId, promotionId);
    if (!promotion) {
      throw new Error("PROMOTION_NOT_FOUND");
    }

    this.promotions.set(promotionId, {
      ...promotion,
      deleted_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * CORE: Evaluate all active promotions against an order context.
   * Returns deterministic, explainable results.
   *
   * Algorithm:
   * 1. Load all active promotions for the tenant/branch/channel
   * 2. Filter by date range, branch, channel
   * 3. Evaluate each promotion's conditions against the order context
   * 4. Calculate applicable discounts
   * 5. Resolve conflicts via priority + stacking rules
   * 6. Return ordered list of applicable promotions
   */
  evaluatePromotions(context: PromotionOrderContext): PromotionEvaluationResult {
    const now = new Date();

    // Step 1: Get all eligible promotions for this context
    const eligible = Array.from(this.promotions.values()).filter((p) => {
      if (p.tenant_id !== context.tenantId) return false;
      if (p.deleted_at) return false;
      if (!p.is_active) return false;

      // Date range check
      if (p.starts_at && new Date(p.starts_at) > now) return false;
      if (p.ends_at && new Date(p.ends_at) < now) return false;

      // Branch check
      if (p.branch_id && p.branch_id !== context.branchId) return false;

      // Channel restriction
      if (p.channel_restriction && p.channel_restriction.length > 0) {
        if (!p.channel_restriction.includes(context.channel)) return false;
      }

      // Usage limit
      if (p.usage_limit != null && p.usage_count >= p.usage_limit) return false;

      // Minimum order amount
      if (p.min_order_amount != null && context.subtotal < p.min_order_amount) return false;

      return true;
    });

    // Step 2: Evaluate conditions for each promotion
    const matched: AppliedPromotion[] = [];

    for (const promotion of eligible) {
      const conditionsMet = this.evaluateConditions(promotion.conditions, context);
      if (!conditionsMet) continue;

      const calculatedDiscount = calculateDiscountAmount(
        promotion.discount_type,
        promotion.discount_value,
        context.subtotal,
        promotion.max_discount_amount
      );

      const explanation = this.explainPromotion(promotion, context, conditionsMet);

      matched.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        discountType: promotion.discount_type,
        discountValue: promotion.discount_value,
        calculatedDiscount,
        stackMode: promotion.stack_mode,
        priority: promotion.priority,
        explanation,
      });
    }

    // Step 3: Resolve conflicts
    return this.resolveConflicts(matched, context.subtotal);
  }

  /**
   * Evaluate all conditions of a promotion against the order context.
   * ALL conditions must be met (AND logic).
   */
  evaluateConditions(conditions: PromotionRule[], context: PromotionOrderContext): boolean {
    return conditions.every((rule) => this.evaluateRule(rule, context));
  }

  /**
   * Evaluate a single rule against the order context.
   * Supports customer profile fields, order fields, and item fields.
   */
  evaluateRule(rule: PromotionRule, context: PromotionOrderContext): boolean {
    const fieldValue = this.resolveFieldValue(rule.field, context);
    if (fieldValue === undefined) return false;

    return this.compareValues(fieldValue, rule.operator, rule.value);
  }

  /**
   * Resolve the value of a field from the promotion order context.
   */
  private resolveFieldValue(
    field: string,
    context: PromotionOrderContext
  ): string | number | boolean | undefined {
    // Customer profile fields (supports both "customer.is_first_order" and "is_first_order", camelCase & snake_case)
    if (context.customerProfile) {
      const cp = context.customerProfile as Record<string, any>;
      const subfield = field.startsWith("customer.") ? field.substring("customer.".length) : field;
      switch (subfield) {
        case "is_first_order":
        case "isFirstOrder":
          return cp.isFirstOrder ?? cp.is_first_order;
        case "total_orders_count":
        case "totalOrdersCount":
          return cp.totalOrdersCount ?? cp.total_orders_count;
        case "total_spent_amount":
        case "totalSpentAmount":
          return cp.totalSpentAmount ?? cp.total_spent_amount;
        case "is_vip":
        case "isVip":
          return cp.isVip ?? cp.is_vip;
        case "is_birthday":
        case "isBirthday":
          return cp.isBirthday ?? cp.is_birthday;
        case "days_since_last_order":
        case "daysSinceLastOrder":
          return cp.daysSinceLastOrder ?? cp.days_since_last_order;
        case "loyalty_tier":
        case "loyaltyTier":
          return cp.loyaltyTier ?? cp.loyalty_tier;
      }
    }

    // Order-level fields
    switch (field) {
      case "order.subtotal":
      case "subtotal":
        return context.subtotal;
      case "order.channel":
      case "channel":
        return context.channel;
      case "order.type":
      case "orderType":
      case "type":
        return context.orderType;
      case "order.item_count":
      case "itemCount":
        return context.items.reduce((sum, item) => sum + item.quantity, 0);
      default:
        return undefined;
    }
  }

  /**
   * Compare a resolved value against a rule's expected value using the operator.
   */
  private compareValues(
    actual: string | number | boolean,
    operator: SegmentOperator,
    expected: string | number | boolean | string[] | number[]
  ): boolean {
    switch (operator) {
      case "EQUALS":
        if (typeof actual === "boolean") {
          return actual === (expected === true || expected === "true" || expected === "True" || expected === 1 || expected === "1");
        }
        if (typeof actual === "number") {
          return actual === Number(expected);
        }
        return actual === expected || String(actual) === String(expected);
      case "NOT_EQUALS":
        if (typeof actual === "boolean") {
          return actual !== (expected === true || expected === "true" || expected === "True" || expected === 1 || expected === "1");
        }
        if (typeof actual === "number") {
          return actual !== Number(expected);
        }
        return actual !== expected && String(actual) !== String(expected);
      case "GREATER_THAN":
        return typeof actual === "number" && !isNaN(Number(expected)) && actual > Number(expected);
      case "LESS_THAN":
        return typeof actual === "number" && !isNaN(Number(expected)) && actual < Number(expected);
      case "GREATER_THAN_OR_EQUAL":
        return typeof actual === "number" && !isNaN(Number(expected)) && actual >= Number(expected);
      case "LESS_THAN_OR_EQUAL":
        return typeof actual === "number" && !isNaN(Number(expected)) && actual <= Number(expected);
      case "BETWEEN":
        if (typeof actual === "number" && Array.isArray(expected) && expected.length === 2) {
          const [min, max] = expected as number[];
          return actual >= min && actual <= max;
        }
        return false;
      case "IN":
        if (Array.isArray(expected)) {
          return expected.includes(actual as never);
        }
        return false;
      case "NOT_IN":
        if (Array.isArray(expected)) {
          return !expected.includes(actual as never);
        }
        return true;
      default:
        return false;
    }
  }

  /**
   * Conflict resolution: applies stacking rules and priority.
   *
   * Strategy:
   * 1. Sort by priority (highest first)
   * 2. EXCLUSIVE promotions: only the highest-priority wins
   * 3. STACKABLE promotions: accumulate all
   * 4. BEST_DEAL: select the one with max discount
   * 5. Total discount cannot exceed subtotal
   */
  resolveConflicts(
    matched: AppliedPromotion[],
    subtotal: number
  ): PromotionEvaluationResult {
    if (matched.length === 0) {
      return { appliedPromotions: [], totalDiscount: 0, explanations: ["No promotions matched this order."] };
    }

    // Sort by priority descending
    const sorted = [...matched].sort((a, b) => b.priority - a.priority);

    const applied: AppliedPromotion[] = [];
    let totalDiscount = 0;
    const explanations: string[] = [];

    // Check if any BEST_DEAL promotions exist
    const bestDealPromotions = sorted.filter((p) => p.stackMode === "BEST_DEAL");
    if (bestDealPromotions.length > 0) {
      // Among BEST_DEAL, pick the one with the highest discount
      const best = bestDealPromotions.reduce((max, p) =>
        p.calculatedDiscount > max.calculatedDiscount ? p : max
      );
      applied.push(best);
      totalDiscount = best.calculatedDiscount;
      explanations.push(`Best deal applied: ${best.promotionName} (${best.explanation})`);

      // BEST_DEAL is exclusive — no stacking with others
      return { appliedPromotions: applied, totalDiscount: Math.min(totalDiscount, subtotal), explanations };
    }

    // Process EXCLUSIVE first — highest priority exclusive wins
    const exclusives = sorted.filter((p) => p.stackMode === "EXCLUSIVE");
    if (exclusives.length > 0) {
      const winner = exclusives[0]; // Highest priority
      applied.push(winner);
      totalDiscount += winner.calculatedDiscount;
      explanations.push(`Exclusive promotion applied: ${winner.promotionName} (${winner.explanation})`);

      // Skip remaining exclusives
      for (let i = 1; i < exclusives.length; i++) {
        explanations.push(
          `Skipped: ${exclusives[i].promotionName} — lower priority exclusive promotion`
        );
      }
    }

    // Process STACKABLE — all stack on top of the exclusive winner
    const stackables = sorted.filter((p) => p.stackMode === "STACKABLE");
    for (const promo of stackables) {
      applied.push(promo);
      totalDiscount += promo.calculatedDiscount;
      explanations.push(`Stacked promotion: ${promo.promotionName} (${promo.explanation})`);
    }

    // Cap at subtotal
    totalDiscount = Math.min(totalDiscount, subtotal);
    totalDiscount = Math.round(totalDiscount * 100) / 100;

    return { appliedPromotions: applied, totalDiscount, explanations };
  }

  /**
   * Generate a human-readable explanation of why a promotion was applied.
   */
  private explainPromotion(
    promotion: Promotion,
    _context: PromotionOrderContext,
    _conditionsMet: boolean
  ): string {
    const parts: string[] = [];

    for (const rule of promotion.conditions) {
      parts.push(`${rule.field} ${rule.operator.toLowerCase().replace(/_/g, " ")} ${JSON.stringify(rule.value)}`);
    }

    const conditionStr = parts.join(" AND ");
    const discountStr =
      promotion.discount_type === "PERCENTAGE"
        ? `${promotion.discount_value}% off`
        : promotion.discount_type === "FIXED_AMOUNT"
        ? `₪${promotion.discount_value} off`
        : promotion.discount_type === "FREE_DELIVERY"
        ? "Free delivery"
        : promotion.discount_type === "FREE_ITEM"
        ? "Free item"
        : promotion.discount_type === "BOGO"
        ? "Buy one get one"
        : `${promotion.discount_value} discount`;

    return `IF ${conditionStr} THEN ${discountStr}`;
  }

  /** Test helper: inject promotion directly */
  _injectPromotion(promotion: Promotion): void {
    this.promotions.set(promotion.id, promotion);
  }
}
