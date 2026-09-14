import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "driver.operate")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  const branchId = auth.branchId;
  if (!tenantId || !branchId) {
    return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
  }

  try {
    const driver = await driverQueueService.startBreak(tenantId, branchId, auth.session.userId);
    return NextResponse.json({ driver });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to start break" }, { status: 400 });
  }
}
