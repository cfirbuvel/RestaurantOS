import crypto from "crypto";
import { IPaymentGatewayAdapter } from "./payment-gateway-adapter";
import { UniversalPaymentDTO, PaymentResult, RefundResult } from "../domain/canonical-dtos";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";

export class MeshulamAdapter implements IPaymentGatewayAdapter {
  readonly providerName = "MESHULAM" as const;

  constructor(
    protected pageCode: string = process.env.MESHULAM_PAGE_CODE || "mock-meshulam-page",
    protected apiKey: string = process.env.MESHULAM_API_KEY || "mock-meshulam-key",
    protected secret: string = process.env.MESHULAM_SECRET || "mock-meshulam-secret"
  ) {}

  async processPayment(payment: UniversalPaymentDTO): Promise<PaymentResult> {
    if (payment.amount <= 0) {
      return { success: false, status: "FAILED", error: "Payment amount must be greater than zero" };
    }

    const txId = `meshulam-${crypto.randomUUID().slice(0, 12)}`;
    return {
      success: true,
      transactionId: txId,
      status: "PAID",
      approvalCode: "000000",
      lastFourDigits: payment.cardDetails?.cardNumber?.slice(-4) || "1234",
      cardBrand: "ISRACARD",
      amount: payment.amount,
      currency: payment.currency,
      token: payment.token || `tok_meshulam_${crypto.randomUUID().slice(0, 8)}`,
    };
  }

  async tokenizeCard(cardDetails: any): Promise<{ success: boolean; token?: string; error?: string }> {
    const token = `tok_meshulam_${crypto.randomUUID().slice(0, 16)}`;
    return { success: true, token };
  }

  async processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    return {
      success: true,
      refundId: `ref_${transactionId}_${Date.now().toString().slice(-4)}`,
      amount,
      currency: "ILS",
    };
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>, secret?: string): boolean {
    const sig = headers["x-meshulam-signature"] || headers["x-signature"] || "";
    const ts = headers["x-meshulam-timestamp"] || headers["x-timestamp"];
    const timestamp = ts ? parseInt(ts, 10) : undefined;
    const res = verifyWebhookSignature({
      body: rawBody,
      signature: sig,
      secret: secret || this.secret,
      timestamp,
      toleranceSeconds: 300,
      provider: "Meshulam",
    });
    return res.valid;
  }
}

export class MockMeshulamAdapter extends MeshulamAdapter {
  public processedTransactions: Array<{ payment: UniversalPaymentDTO; result: PaymentResult }> = [];
  public refunds: Array<{ transactionId: string; amount: number; reason?: string }> = [];
  public shouldDecline: boolean = false;
  public declineReason: string = "Card declined by issuer (Do Not Honor)";

  async processPayment(payment: UniversalPaymentDTO): Promise<PaymentResult> {
    if (this.shouldDecline) {
      const failedResult: PaymentResult = {
        success: false,
        status: "FAILED",
        error: this.declineReason,
        approvalCode: "005", // Standard refusal code
      };
      this.processedTransactions.push({ payment, result: failedResult });
      return failedResult;
    }

    const txId = `meshulam-mock-${Date.now()}`;
    const result: PaymentResult = {
      success: true,
      transactionId: txId,
      status: "PAID",
      approvalCode: "000000",
      lastFourDigits: payment.cardDetails?.cardNumber?.slice(-4) || "4242",
      cardBrand: "MASTERCARD_IL",
      amount: payment.amount,
      currency: payment.currency,
      token: payment.token || `tok_mesh_${Date.now()}`,
    };

    this.processedTransactions.push({ payment, result });
    return result;
  }

  async processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    this.refunds.push({ transactionId, amount, reason });
    return {
      success: true,
      refundId: `ref-mock-${transactionId}`,
      amount,
      currency: "ILS",
    };
  }

  signPayload(payload: string | Buffer, secret: string = this.secret): string {
    const raw = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    return "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  }
}
