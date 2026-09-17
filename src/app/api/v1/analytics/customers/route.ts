import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { analyticsService } from "@/modules/analytics";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "analytics.view") && !verifyPermission(auth.session, "reports.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  try {
    const metrics = await analyticsService.getCustomerAnalytics(tenantId, startDate, endDate);
    return NextResponse.json({ success: true, data: metrics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load customer analytics" }, { status: 500 });
  }
}
