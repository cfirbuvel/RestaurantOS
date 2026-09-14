import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { deliveryService } from "@/modules/delivery/services/delivery-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "delivery.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Optional
    }

    const reason = body.reason || "Cancelled by manager";
    const delivery = await deliveryService.cancelDelivery(tenantId, id, reason);
    return NextResponse.json({ delivery });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to cancel delivery" }, { status: 400 });
  }
}
