import { UniversalExternalOrderDTO } from "../domain/canonical-dtos";
import { OrderStatus } from "@/modules/orders/domain/order";

export interface IAggregatorAdapter {
  readonly providerName: "WOLT" | "TENBIS" | "MISHLOHA";
  
  /**
   * Verify signature of inbound webhook
   */
  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>, secret: string): boolean;

  /**
   * Transform proprietary vendor payload into Canonical UniversalExternalOrderDTO
   */
  transformToCanonicalOrder(rawPayload: any): UniversalExternalOrderDTO;

  /**
   * Send order status update back to the aggregator
   */
  sendOrderStatusUpdate(
    externalOrderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Sync catalog/menu availability to aggregator
   */
  syncCatalog?(catalog: any): Promise<{ success: boolean; error?: string }>;
}
