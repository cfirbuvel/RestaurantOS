import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { realtimeService } from "@/modules/realtime/services/realtime-service";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const branchId = body.branchId || auth.branchId;
    if (!tenantId || !branchId) {
      return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
    }

    const role = auth.session.role;
    if (!role) {
      return NextResponse.json({ error: "Forbidden: user role required" }, { status: 403 });
    }

    const { stationId, channel } = body;

    const result = await realtimeService.issueTicket({
      tenantId,
      branchId,
      userId: auth.session.userId,
      role,
      stationId: stationId || null,
      channel,
      ttlSeconds: 60, // 60 seconds TTL (PHASE 00 Section 28)
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to issue realtime ticket" }, { status: 403 });
  }
}
