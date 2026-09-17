import { CampaignService } from "./services/campaign-service";
import { CouponService } from "./services/coupon-service";
import { PromotionEngine } from "./services/promotion-engine";
import { LoyaltyService } from "./services/loyalty-service";
import { SegmentService } from "./services/segment-service";
import { MarketingOrderSubscriber } from "./subscribers/marketing-order-subscriber";

const globalForMarketing = globalThis as unknown as {
  campaignService?: CampaignService;
  couponService?: CouponService;
  promotionEngine?: PromotionEngine;
  loyaltyService?: LoyaltyService;
  segmentService?: SegmentService;
  marketingOrderSubscriber?: MarketingOrderSubscriber;
};

export const campaignService =
  globalForMarketing.campaignService ?? new CampaignService();
export const couponService =
  globalForMarketing.couponService ?? new CouponService();
export const promotionEngine =
  globalForMarketing.promotionEngine ?? new PromotionEngine();
export const loyaltyService =
  globalForMarketing.loyaltyService ?? new LoyaltyService();
export const segmentService =
  globalForMarketing.segmentService ?? new SegmentService();
export const marketingOrderSubscriber =
  globalForMarketing.marketingOrderSubscriber ??
  new MarketingOrderSubscriber(loyaltyService, couponService);

globalForMarketing.campaignService = campaignService;
globalForMarketing.couponService = couponService;
globalForMarketing.promotionEngine = promotionEngine;
globalForMarketing.loyaltyService = loyaltyService;
globalForMarketing.segmentService = segmentService;
globalForMarketing.marketingOrderSubscriber = marketingOrderSubscriber;

export * from "./domain/marketing";
export * from "./services/campaign-service";
export * from "./services/coupon-service";
export * from "./services/promotion-engine";
export * from "./services/loyalty-service";
export * from "./services/segment-service";
export * from "./subscribers/marketing-order-subscriber";
