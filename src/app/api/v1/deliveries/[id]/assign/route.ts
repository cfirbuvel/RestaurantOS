import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { assignDeliverySchema } from "@/modules/delivery/domain/delivery";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "delivery.assign")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validated = assignDeliverySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const delivery = await deliveryService.assignDelivery({
      tenantId,
      deliveryId: id,
      driverId: validated.data.driverId,
      vehicleId: validated.data.vehicleId,
      actorId: auth.session.userId,
      actorType: "MANAGER",
      reason: validated.data.reason,
    });

    return NextResponse.json({ delivery });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to assign delivery" }, { status: 400 });
  }
}
