import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "delivery.read") && !verifyPermission(auth.session, "orders.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  if (!branchId) {
    return NextResponse.json({ error: "Branch context required" }, { status: 400 });
  }

  try {
    const drivers = await driverQueueService.getAllBranchDrivers(tenantId, branchId);
    return NextResponse.json({ drivers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch branch drivers" }, { status: 500 });
  }
}
