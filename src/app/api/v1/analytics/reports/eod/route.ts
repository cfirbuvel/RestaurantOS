import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { reportingService } from "@/modules/analytics";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "reports.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  if (!branchId) {
    return NextResponse.json({ error: "Branch ID required for Z-Report" }, { status: 400 });
  }

  const dateStr = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const report = await reportingService.generateEODReport(tenantId, branchId, dateStr, auth.userId);
    return NextResponse.json({ success: true, data: report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate EOD report" }, { status: 500 });
  }
}
