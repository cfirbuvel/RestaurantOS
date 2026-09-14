import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { stockCountService } from "@/modules/inventory/services/stock-count-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "inventory.adjust") && !verifyPermission(auth.session, "inventory.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const branchId = body.branchId || auth.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch context required" }, { status: 400 });
    }

    const result = await stockCountService.reconcileCount({
      tenantId,
      branchId,
      countId: id,
      reconciledBy: auth.session.userId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reconcile count" }, { status: 400 });
  }
}
