import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { telephonyService } from "@/modules/telephony";

/**
 * List Call Logs
 */
export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "telephony.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || undefined;
  const status = url.searchParams.get("status") as any || undefined;
  const customerId = url.searchParams.get("customerId") || undefined;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 50;

  const logs = await telephonyService.getCallLogs(tenantId, {
    branchId,
    status,
    customerId,
    limit,
  });

  return NextResponse.json({
    data: logs,
    total: logs.length,
  });
}
