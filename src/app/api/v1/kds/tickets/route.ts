import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { kdsService } from "@/modules/kds/services/kds-service";
import { KDSTicketStatus } from "@/modules/kds/domain/kds";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "kds.view")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const url = new URL(req.url);
  const tenantId = auth.organizationId;
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  if (!tenantId || !branchId) {
    return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
  }

  const stationId = url.searchParams.get("stationId") || null;
  const statusParam = url.searchParams.get("status");

  const statuses: KDSTicketStatus[] = statusParam
    ? (statusParam.split(",") as KDSTicketStatus[])
    : ["QUEUED", "STARTED", "READY", "RECALLED"];

  const tickets = await kdsService.getTicketsForStation(tenantId, branchId, stationId, statuses);
  return NextResponse.json({ tickets });
}
