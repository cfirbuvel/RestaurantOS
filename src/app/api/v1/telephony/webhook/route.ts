import { NextRequest, NextResponse } from "next/server";
import { telephonyService } from "@/modules/telephony";

/**
 * PBX / VoIP Webhook Ingestion Endpoint
 * Phase 0 Section 36: 10-step integration pipeline
 * Phase 0 Section 37: Webhook Idempotency
 * Supports incoming call ring events and call status updates from PBX/SIP trunk
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const adapter = telephonyService.getAdapter();

    // Verify webhook signature
    const headerRecord: Record<string, string | undefined> = {};
    req.headers.forEach((val, key) => {
      headerRecord[key.toLowerCase()] = val;
    });

    if (!adapter.verifyWebhookSignature(headerRecord, rawBody)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    // Tenant context: can come from header, query param, or payload
    const tenantId =
      req.headers.get("x-tenant-id") ||
      new URL(req.url).searchParams.get("tenantId") ||
      rawBody.tenantId ||
      "tenant_default";

    const branchId =
      req.headers.get("x-branch-id") ||
      new URL(req.url).searchParams.get("branchId") ||
      rawBody.branchId ||
      undefined;

    // Determine event type: ringing vs status update
    const eventType = rawBody.event || rawBody.EventType || rawBody.type;

    if (eventType === "status_update" || rawBody.status === "ANSWERED" || rawBody.status === "COMPLETED" || rawBody.CallStatus) {
      const updatedLog = await telephonyService.handleCallStatusUpdate(tenantId, rawBody);
      return NextResponse.json({
        success: true,
        type: "status_update",
        callLog: updatedLog,
      });
    }

    // Default: Incoming ringing call
    const result = await telephonyService.handleIncomingCall(tenantId, rawBody, { branchId });
    return NextResponse.json({
      success: true,
      type: "incoming_call",
      callLog: result.callLog,
      callerId: result.callerId,
    });
  } catch (error: any) {
    console.error("Telephony webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing error", message: error?.message },
      { status: 500 }
    );
  }
}
