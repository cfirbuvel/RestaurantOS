import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { driverQueueService } from "@/modules/delivery/services/driver-queue-service";

/**
 * GET /api/v1/drivers/me
 *
 * Returns the authenticated driver's own DriverRecord (shift_status, assignment_status,
 * trip_status, available_since). Auto-creates the record if it does not yet exist.
 *
 * Used by the Driver Android app on startup and after every lifecycle action.
 */
export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const branchId = auth.branchId;
  if (!branchId) {
    return NextResponse.json({ error: "Branch context required" }, { status: 400 });
  }

  const userId = auth.session.userId;

  try {
    const driver = await driverQueueService.getOrCreateDriver(tenantId, branchId, userId);
    return NextResponse.json({ driver });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load driver profile" },
      { status: 500 }
    );
  }
}
