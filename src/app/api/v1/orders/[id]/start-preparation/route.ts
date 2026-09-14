import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { orderService } from "@/modules/orders/services/order-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !verifyPermission(auth.session, "kds.bump") &&
    !verifyPermission(auth.session, "orders.update")
  ) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const updated = await orderService.startPreparation(tenantId, id, auth.userId);
    return NextResponse.json({
      success: true,
      message: "Order preparation started",
      order: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to start preparation" }, { status: 400 });
  }
}
