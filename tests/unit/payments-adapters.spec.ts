import { describe, it, expect, beforeEach } from "vitest";
import { MockMeshulamAdapter } from "@/modules/integrations/payments/meshulam-adapter";
import { MockStripeAdapter } from "@/modules/integrations/payments/stripe-adapter";
import { UniversalPaymentDTO } from "@/modules/integrations/domain/canonical-dtos";

describe("Payment Gateway Adapters (Meshulam, Stripe)", () => {
  let meshulam: MockMeshulamAdapter;
  let stripe: MockStripeAdapter;

  const samplePayment: UniversalPaymentDTO = {
    tenantId: "1b9ca808-44c7-4fec-b94f-05c133c959f0",
    branchId: "be7c3e30-b28b-4d23-9d78-b56b545351f5",
    orderId: "ord-pay-123",
    provider: "MESHULAM",
    amount: 150.00,
    currency: "ILS",
    paymentMethod: "CREDIT_CARD",
    cardDetails: {
      cardNumber: "4580123456784242",
      expMonth: "12",
      expYear: "28",
      cvv: "789",
      holderName: "דן שרון",
    },
    installments: 1,
    capture: true,
    metadata: {},
  };

  beforeEach(() => {
    meshulam = new MockMeshulamAdapter();
    stripe = new MockStripeAdapter();
  });

  it("Meshulam: processes card payment and generates token & approval code", async () => {
    const res = await meshulam.processPayment(samplePayment);
    expect(res.success).toBe(true);
    expect(res.status).toBe("PAID");
    expect(res.approvalCode).toBe("000000");
    expect(res.token).toBeDefined();
    expect(res.lastFourDigits).toBe("4242");
    expect(meshulam.processedTransactions.length).toBe(1);
  });

  it("Meshulam: handles card decline with appropriate refusal code", async () => {
    meshulam.shouldDecline = true;
    const res = await meshulam.processPayment(samplePayment);
    expect(res.success).toBe(false);
    expect(res.status).toBe("FAILED");
    expect(res.approvalCode).toBe("005");
    expect(res.error).toContain("Card declined");
  });

  it("Meshulam: executes transaction refund", async () => {
    const refund = await meshulam.processRefund("tx-9999", 50.00, "Customer returned item");
    expect(refund.success).toBe(true);
    expect(refund.refundId).toBeDefined();
    expect(refund.amount).toBe(50.00);
    expect(meshulam.refunds.length).toBe(1);
  });

  it("Stripe: creates PaymentIntent and captures payment", async () => {
    const stripePayment: UniversalPaymentDTO = {
      ...samplePayment,
      provider: "STRIPE",
      currency: "USD",
      amount: 45.00,
    };

    const res = await stripe.processPayment(stripePayment);
    expect(res.success).toBe(true);
    expect(res.status).toBe("PAID");
    expect(res.transactionId).toMatch(/^pi_/);
    expect(res.amount).toBe(45.00);
    expect(stripe.charges.length).toBe(1);
  });

  it("Stripe: verifies webhook signatures", () => {
    const payload = JSON.stringify({ type: "payment_intent.succeeded", id: "pi_123" });
    const secret = "whsec_test_123";
    const sig = stripe.signPayload(payload, secret);
    const isValid = stripe.verifyWebhook(
      payload,
      {
        "stripe-signature": sig,
        "x-stripe-timestamp": Math.floor(Date.now() / 1000).toString(),
      },
      secret
    );
    expect(isValid).toBe(true);
  });
});
