import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { reportingService } from "@/modules/analytics";
import { memoryDb } from "@/core/database/db";

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

  const sessions = memoryDb.find("cash_drawer_sessions", (s: any) => {
    if (s.tenant_id !== tenantId) return false;
    if (branchId && s.branch_id !== branchId) return false;
    return true;
  });

  return NextResponse.json({ success: true, data: sessions });
}

export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json();
    const action = body.action; // "OPEN" | "CLOSE"

    if (action === "OPEN") {
      const branchId = body.branchId || auth.branchId;
      if (!branchId) {
        return NextResponse.json({ error: "Branch ID required" }, { status: 400 });
      }
      const terminalId = body.terminalId || "POS-01";
      const openingFloat = Number(body.openingFloat || 500);

      const session = await reportingService.openCashDrawer(
        tenantId,
        branchId,
        terminalId,
        openingFloat,
        auth.userId
      );
      return NextResponse.json({ success: true, data: session });
    }

    if (action === "CLOSE") {
      const sessionId = body.sessionId;
      if (!sessionId) {
        return NextResponse.json({ error: "Session ID required" }, { status: 400 });
      }
      const countedCash = Number(body.countedCash || 0);
      const notes = body.notes;

      const session = await reportingService.closeCashDrawer(tenantId, sessionId, countedCash, notes);
      return NextResponse.json({ success: true, data: session });
    }

    return NextResponse.json({ error: "Invalid action. Supported: OPEN, CLOSE" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process cash drawer request" }, { status: 500 });
  }
}
