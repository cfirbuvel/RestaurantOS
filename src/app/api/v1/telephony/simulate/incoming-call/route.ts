import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { telephonyService, simulateIncomingCallSchema } from "@/modules/telephony";

/**
 * Simulator Endpoint for Operator Testing & Development
 * Allows sending test incoming call events to trigger Caller ID popups
 */
export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "telephony.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = simulateIncomingCallSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { callerNumber, branchId, destinationNumber } = validated.data;
    const sessionId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const result = await telephonyService.handleIncomingCall(
      tenantId,
      {
        sessionId,
        callerNumber,
        destinationNumber,
        branchId: branchId || auth.session.branchId,
        timestamp: new Date().toISOString(),
        direction: "INBOUND",
        metadata: { simulated: true, simulatedBy: auth.session.userId },
      },
      { branchId: branchId || auth.session.branchId }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Simulated incoming call triggered",
        sessionId,
        callerId: result.callerId,
        callLog: result.callLog,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Telephony simulator error:", error);
    return NextResponse.json(
      { error: "Simulation error", message: error?.message },
      { status: 500 }
    );
  }
}
