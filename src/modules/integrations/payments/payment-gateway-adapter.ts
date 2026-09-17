import { UniversalPaymentDTO, PaymentResult, RefundResult } from "../domain/canonical-dtos";

export interface IPaymentGatewayAdapter {
  readonly providerName: "MESHULAM" | "STRIPE";

  /**
   * Process a direct card/token charge or authorization
   */
  processPayment(payment: UniversalPaymentDTO): Promise<PaymentResult>;

  /**
   * Tokenize customer payment method for recurring/saved transactions
   */
  tokenizeCard?(cardDetails: any): Promise<{ success: boolean; token?: string; error?: string }>;

  /**
   * Process refund against prior transaction
   */
  processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult>;

  /**
   * Verify signature on inbound payment webhook notification
   */
  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>, secret?: string): boolean;
}
