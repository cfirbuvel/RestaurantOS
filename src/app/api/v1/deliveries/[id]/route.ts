import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { deliveryService } from "@/modules/delivery/services/delivery-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "delivery.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;
  const delivery = await deliveryService.getDeliveryById(tenantId, id);
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  // Data minimization for drivers (PHASE 00 Section 31)
  if (auth.session.role === "DRIVER") {
    return NextResponse.json({ delivery: deliveryService.toDeliveryViewDTO(delivery) });
  }

  return NextResponse.json({ delivery });
}
