import crypto from "crypto";
import { IPaymentGatewayAdapter } from "./payment-gateway-adapter";
import { UniversalPaymentDTO, PaymentResult, RefundResult } from "../domain/canonical-dtos";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";

export class StripeAdapter implements IPaymentGatewayAdapter {
  readonly providerName = "STRIPE" as const;

  constructor(
    protected secretKey: string = process.env.STRIPE_SECRET_KEY || "mock-stripe-secret",
    protected webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET || "mock-stripe-wh-secret"
  ) {}

  async processPayment(payment: UniversalPaymentDTO): Promise<PaymentResult> {
    if (payment.amount <= 0) {
      return { success: false, status: "FAILED", error: "Payment amount must be greater than zero" };
    }

    const piId = `pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    return {
      success: true,
      transactionId: piId,
      status: payment.capture ? "PAID" : "AUTHORIZED",
      approvalCode: "stripe_success",
      lastFourDigits: payment.cardDetails?.cardNumber?.slice(-4) || "4242",
      cardBrand: "VISA",
      amount: payment.amount,
      currency: payment.currency,
      token: payment.token || `pm_${crypto.randomUUID().slice(0, 16)}`,
    };
  }

  async tokenizeCard(cardDetails: any): Promise<{ success: boolean; token?: string; error?: string }> {
    const token = `pm_${crypto.randomUUID().slice(0, 20)}`;
    return { success: true, token };
  }

  async processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    return {
      success: true,
      refundId: `re_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
      amount,
      currency: "ILS",
    };
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>, secret?: string): boolean {
    const sig = headers["stripe-signature"] || headers["x-stripe-signature"] || "";
    const ts = headers["x-stripe-timestamp"] || headers["x-timestamp"];
    const timestamp = ts ? parseInt(ts, 10) : undefined;
    const res = verifyWebhookSignature({
      body: rawBody,
      signature: sig,
      secret: secret || this.webhookSecret,
      timestamp,
      toleranceSeconds: 300,
      provider: "Stripe",
    });
    return res.valid;
  }
}

export class MockStripeAdapter extends StripeAdapter {
  public charges: Array<{ payment: UniversalPaymentDTO; result: PaymentResult }> = [];
  public refunds: Array<{ transactionId: string; amount: number; reason?: string }> = [];
  public shouldFail: boolean = false;
  public failureMessage: string = "Your card was declined.";

  async processPayment(payment: UniversalPaymentDTO): Promise<PaymentResult> {
    if (this.shouldFail) {
      const failedResult: PaymentResult = {
        success: false,
        status: "FAILED",
        error: this.failureMessage,
      };
      this.charges.push({ payment, result: failedResult });
      return failedResult;
    }

    const piId = `pi_mock_${Date.now()}`;
    const result: PaymentResult = {
      success: true,
      transactionId: piId,
      status: payment.capture ? "PAID" : "AUTHORIZED",
      approvalCode: "auth_ok",
      lastFourDigits: payment.cardDetails?.cardNumber?.slice(-4) || "4242",
      cardBrand: "VISA",
      amount: payment.amount,
      currency: payment.currency,
      token: payment.token || `pm_mock_${Date.now()}`,
    };

    this.charges.push({ payment, result });
    return result;
  }

  async processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    this.refunds.push({ transactionId, amount, reason });
    return {
      success: true,
      refundId: `re_mock_${transactionId}`,
      amount,
      currency: "ILS",
    };
  }

  signPayload(payload: string | Buffer, secret: string = this.webhookSecret): string {
    const raw = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    return "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  }
}
