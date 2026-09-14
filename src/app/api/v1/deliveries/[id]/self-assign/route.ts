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

  if (!verifyPermission(auth.session, "delivery.self_assign")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const delivery = await deliveryService.selfAssignDelivery(
      tenantId,
      id,
      auth.session.userId
    );

    return NextResponse.json({
      delivery: deliveryService.toDeliveryViewDTO(delivery),
    });
  } catch (err: any) {
    if (err.code === "DELIVERY_ALREADY_ASSIGNED" || err.statusCode === 409) {
      return NextResponse.json(
        {
          error: {
            code: "DELIVERY_ALREADY_ASSIGNED",
            message: "The specified delivery has already been assigned to another driver.",
          },
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message || "Failed to self-assign delivery" }, { status: 400 });
  }
}
