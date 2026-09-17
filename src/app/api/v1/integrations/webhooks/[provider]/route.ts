import { NextRequest, NextResponse } from "next/server";
import { integrationHubService } from "@/modules/integrations/services/integration-hub-service";
import { integrationPipelineRunner } from "@/modules/integrations/core/integration-pipeline";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await context.params;
    const providerUpper = provider.toUpperCase();

    // Read raw body as text/buffer to maintain exact character encoding for HMAC
    const rawBody = await req.text();

    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const tenantId =
      req.headers.get("x-tenant-id") ||
      new URL(req.url).searchParams.get("tenantId") ||
      "1b9ca808-44c7-4fec-b94f-05c133c959f0";

    const branchId =
      req.headers.get("x-branch-id") ||
      new URL(req.url).searchParams.get("branchId") ||
      "be7c3e30-b28b-4d23-9d78-b56b545351f5";

    // ── 1. Aggregators (Wolt, 10bis, Mishloha) ──────────────────────────────
    if (["WOLT", "TENBIS", "MISHLOHA"].includes(providerUpper)) {
      const adapter = integrationHubService.getAggregator(providerUpper);

      const secret =
        process.env[`${providerUpper}_WEBHOOK_SECRET`] ||
        `mock-${provider.toLowerCase()}-secret`;

      const result = await integrationPipelineRunner.processInboundOrder({
        provider: providerUpper as "WOLT" | "TENBIS" | "MISHLOHA",
        rawBody,
        headers,
        secret,
        tenantId,
        branchId,
        transform: (payload) => adapter.transformToCanonicalOrder(payload),
      });

      return NextResponse.json(
        {
          success: result.success,
          duplicate: result.duplicate,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          reason: result.reason,
        },
        { status: result.statusCode }
      );
    }

    // ── 2. Payment Webhooks (Meshulam, Stripe) ───────────────────────────────
    if (["MESHULAM", "STRIPE"].includes(providerUpper)) {
      const gateway = integrationHubService.getPaymentGateway(providerUpper);
      const secret =
        process.env[`${providerUpper}_WEBHOOK_SECRET`] ||
        `mock-${provider.toLowerCase()}-wh-secret`;

      const isValid = gateway.verifyWebhook(rawBody, headers, secret);
      if (!isValid) {
        return NextResponse.json(
          { error: `Invalid ${providerUpper} webhook signature` },
          { status: 401 }
        );
      }

      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(rawBody);
      } catch {
        // raw body might not be json
      }

      return NextResponse.json({
        success: true,
        received: true,
        provider: providerUpper,
        eventType: parsedPayload.type || parsedPayload.event || "payment_webhook",
      });
    }

    return NextResponse.json(
      { error: `Unsupported integration provider "${provider}"` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("Integration webhook handler error:", error);
    return NextResponse.json(
      { error: error.message || "Internal integration webhook error" },
      { status: 500 }
    );
  }
}
