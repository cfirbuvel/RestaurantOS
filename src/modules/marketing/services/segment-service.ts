import type { CustomerSegment, PromotionRule, SegmentOperator } from "../domain/marketing";
import { createSegmentSchema, updateSegmentSchema } from "../domain/marketing";

// ============================================================================
// Phase 6: Segment Service — Customer Segmentation for Targeting
// ============================================================================

/**
 * Simplified customer profile for segment evaluation.
 * In production, this would be fetched from the CRM module.
 */
export interface SegmentCustomerData {
  id: string;
  tenant_id: string;
  total_orders_count: number;
  total_spent_amount: number;
  last_order_days_ago?: number | null;
  order_frequency_per_month?: number | null;
  city?: string | null;
  branch_id?: string | null;
  is_vip: boolean;
  loyalty_tier?: string | null;
  products_purchased?: string[];
}

export class SegmentService {
  private segments: Map<string, CustomerSegment> = new Map();

  /**
   * Create a new customer segment with conditions.
   */
  createSegment(tenantId: string, input: Record<string, any>, createdBy?: string): CustomerSegment {
    const parsed = createSegmentSchema.parse(input);

    const segment: CustomerSegment = {
      id: `seg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tenant_id: tenantId,
      name: parsed.name,
      description: parsed.description ?? null,
      conditions: parsed.conditions as PromotionRule[],
      is_active: true,
      created_by: createdBy ?? null,
      created_at: new Date(),
      updated_at: new Date(),
      version: 1,
    };

    this.segments.set(segment.id, segment);
    return segment;
  }

  /**
   * Update a segment.
   */
  updateSegment(tenantId: string, segmentId: string, input: Record<string, any>): CustomerSegment {
    const segment = this.getSegment(tenantId, segmentId);
    if (!segment) {
      throw new Error("SEGMENT_NOT_FOUND");
    }

    const parsed = updateSegmentSchema.parse(input);

    const updated: CustomerSegment = {
      ...segment,
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.conditions !== undefined && { conditions: parsed.conditions as PromotionRule[] }),
      updated_at: new Date(),
      version: segment.version + 1,
    };

    this.segments.set(segmentId, updated);
    return updated;
  }

  /**
   * Get a segment with tenant guard.
   */
  getSegment(tenantId: string, segmentId: string): CustomerSegment | null {
    const segment = this.segments.get(segmentId);
    if (!segment || segment.tenant_id !== tenantId) {
      return null;
    }
    return segment;
  }

  /**
   * List segments with pagination.
   */
  listSegments(
    tenantId: string,
    filters?: { page?: number; limit?: number }
  ): { data: CustomerSegment[]; total: number; page: number; limit: number } {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    const results = Array.from(this.segments.values()).filter(
      (s) => s.tenant_id === tenantId
    );

    const total = results.length;
    const offset = (page - 1) * limit;
    const data = results.slice(offset, offset + limit);

    return { data, total, page, limit };
  }

  /**
   * Delete a segment.
   */
  deleteSegment(tenantId: string, segmentId: string): void {
    const segment = this.getSegment(tenantId, segmentId);
    if (!segment) {
      throw new Error("SEGMENT_NOT_FOUND");
    }
    this.segments.delete(segmentId);
  }

  /**
   * Evaluate a segment against a set of customer data.
   * Returns matching customer IDs.
   */
  evaluateSegment(
    tenantId: string,
    segmentId: string,
    customers: SegmentCustomerData[]
  ): string[] {
    const segment = this.getSegment(tenantId, segmentId);
    if (!segment) {
      throw new Error("SEGMENT_NOT_FOUND");
    }

    return customers
      .filter((customer) => this.matchesAllConditions(customer, segment.conditions))
      .map((customer) => customer.id);
  }

  /**
   * Check if a single customer matches all segment conditions (AND logic).
   */
  matchesAllConditions(customer: SegmentCustomerData, conditions: PromotionRule[]): boolean {
    return conditions.every((rule) => this.evaluateCondition(customer, rule));
  }

  /**
   * Evaluate a single condition against customer data.
   */
  private evaluateCondition(customer: SegmentCustomerData, rule: PromotionRule): boolean {
    const value = this.resolveCustomerField(customer, rule.field);
    if (value === undefined) return false;

    return this.compare(value, rule.operator, rule.value);
  }

  /**
   * Resolve a field value from customer data.
   */
  private resolveCustomerField(
    customer: SegmentCustomerData,
    field: string
  ): string | number | boolean | string[] | undefined {
    switch (field) {
      case "order_count":
      case "total_orders_count":
        return customer.total_orders_count;
      case "total_spend":
      case "total_spent_amount":
        return customer.total_spent_amount;
      case "last_order_days_ago":
        return customer.last_order_days_ago ?? undefined;
      case "frequency":
      case "order_frequency_per_month":
        return customer.order_frequency_per_month ?? undefined;
      case "city":
      case "location":
        return customer.city ?? undefined;
      case "branch":
      case "branch_id":
        return customer.branch_id ?? undefined;
      case "is_vip":
      case "customer_status":
        return customer.is_vip;
      case "loyalty_tier":
        return customer.loyalty_tier ?? undefined;
      case "products_purchased":
        return customer.products_purchased ?? undefined;
      default:
        return undefined;
    }
  }

  /**
   * Compare values using the specified operator.
   */
  private compare(
    actual: string | number | boolean | string[],
    operator: SegmentOperator,
    expected: string | number | boolean | string[] | number[]
  ): boolean {
    switch (operator) {
      case "EQUALS":
        return actual === expected;
      case "NOT_EQUALS":
        return actual !== expected;
      case "GREATER_THAN":
        return typeof actual === "number" && typeof expected === "number" && actual > expected;
      case "LESS_THAN":
        return typeof actual === "number" && typeof expected === "number" && actual < expected;
      case "GREATER_THAN_OR_EQUAL":
        return typeof actual === "number" && typeof expected === "number" && actual >= expected;
      case "LESS_THAN_OR_EQUAL":
        return typeof actual === "number" && typeof expected === "number" && actual <= expected;
      case "BETWEEN":
        if (typeof actual === "number" && Array.isArray(expected) && expected.length === 2) {
          const [min, max] = expected as number[];
          return actual >= min && actual <= max;
        }
        return false;
      case "IN":
        if (Array.isArray(expected)) {
          if (Array.isArray(actual)) {
            // Check if any element of actual is in expected
            return actual.some((v) => (expected as string[]).includes(v));
          }
          return (expected as (string | number)[]).includes(actual as string | number);
        }
        return false;
      case "NOT_IN":
        if (Array.isArray(expected)) {
          if (Array.isArray(actual)) {
            return !actual.some((v) => (expected as string[]).includes(v));
          }
          return !(expected as (string | number)[]).includes(actual as string | number);
        }
        return true;
      default:
        return false;
    }
  }

  /** Test helper: inject segment directly */
  _injectSegment(segment: CustomerSegment): void {
    this.segments.set(segment.id, segment);
  }
}
