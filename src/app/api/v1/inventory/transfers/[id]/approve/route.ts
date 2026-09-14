import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { warehouseService } from "@/modules/inventory/services/warehouse-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "inventory.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const transfer = await warehouseService.approveAndDispatchTransfer(
      tenantId,
      id,
      auth.session.userId
    );

    return NextResponse.json({ transfer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to approve transfer" }, { status: 400 });
  }
}
