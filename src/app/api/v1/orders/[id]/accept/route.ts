import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { orderService } from "@/modules/orders/services/order-service";
import { acceptOrderSchema } from "@/modules/orders/domain/order";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !verifyPermission(auth.session, "orders.update") &&
    !verifyPermission(auth.session, "kds.bump")
  ) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  let prepMinutes = 20;
  try {
    const body = await req.json();
    const validated = acceptOrderSchema.safeParse(body);
    if (validated.success) {
      prepMinutes = validated.data.estimatedPrepMinutes;
    }
  } catch {
    // Empty body is acceptable, defaults to 20 minutes
  }

  const { id } = await params;
  try {
    const updated = await orderService.acceptOrder(tenantId, id, prepMinutes, auth.userId);
    return NextResponse.json({
      success: true,
      message: "Order accepted by kitchen",
      order: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to accept order" }, { status: 400 });
  }
}
