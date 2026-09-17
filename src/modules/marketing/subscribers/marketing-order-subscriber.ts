import type { LoyaltyService } from "../services/loyalty-service";
import type { CouponService } from "../services/coupon-service";

// ============================================================================
// Phase 6: Marketing Order Subscriber
// ============================================================================

/**
 * Event-driven integration between the Order domain and the Marketing module.
 *
 * Subscribes to order lifecycle events and triggers marketing side effects:
 * - OrderCompleted → earn loyalty points
 * - OrderCancelled → rollback coupon redemption + rollback loyalty points
 * - OrderCreated → evaluate first-order campaign eligibility (future)
 *
 * In production, these are wired through the Transactional Outbox event bus.
 * This subscriber receives already-committed domain events.
 */
export class MarketingOrderSubscriber {
  constructor(
    private loyaltyService: LoyaltyService,
    private couponService: CouponService
  ) {}

  /**
   * Handle OrderCompleted event.
   * Awards loyalty points based on the order total.
   */
  async onOrderCompleted(event: {
    tenantId: string;
    orderId: string;
    customerId?: string | null;
    totalAmount: number;
  }): Promise<void> {
    if (!event.customerId) return;

    try {
      this.loyaltyService.earnPoints(
        event.tenantId,
        event.customerId,
        event.totalAmount,
        event.orderId
      );
    } catch {
      // Log error but don't fail the order — loyalty is non-critical
      // In production, this would use structured logging
    }
  }

  /**
   * Handle OrderCancelled event.
   * Rolls back coupon redemptions and loyalty points for the cancelled order.
   */
  async onOrderCancelled(event: {
    tenantId: string;
    orderId: string;
    customerId?: string | null;
  }): Promise<void> {
    // Rollback coupon redemption if any
    try {
      this.couponService.rollbackRedemption(event.tenantId, event.orderId);
    } catch {
      // Non-critical — log and continue
    }

    // Rollback loyalty points if any
    if (event.customerId) {
      try {
        this.loyaltyService.rollbackPoints(
          event.tenantId,
          event.customerId,
          event.orderId
        );
      } catch {
        // Non-critical — log and continue
      }
    }
  }
}
