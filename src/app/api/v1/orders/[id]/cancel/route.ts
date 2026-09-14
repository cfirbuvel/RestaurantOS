import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { orderService } from "@/modules/orders/services/order-service";
import { cancelOrderSchema } from "@/modules/orders/domain/order";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "orders.cancel")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  let reason = "Cancelled by user";
  try {
    const body = await req.json();
    const validated = cancelOrderSchema.safeParse(body);
    if (validated.success) {
      reason = validated.data.reason;
    }
  } catch {
    // Default reason used if body omitted
  }

  const { id } = await params;
  try {
    const updated = await orderService.cancelOrder(tenantId, id, reason, auth.userId);
    return NextResponse.json({
      success: true,
      message: "Order cancelled successfully",
      order: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to cancel order" }, { status: 400 });
  }
}
