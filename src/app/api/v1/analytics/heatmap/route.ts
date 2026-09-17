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
  const branchId = url.searchParams.get("branchId") || auth.branchId || undefined;

  try {
    const [heatmap, peakHours] = await Promise.all([
      analyticsService.getHourlyHeatmap(tenantId, branchId),
      analyticsService.getPeakHourAnalysis(tenantId, branchId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        heatmap,
        peakHours,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load heatmap" }, { status: 500 });
  }
}
