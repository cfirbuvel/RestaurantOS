import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { createDeliverySchema } from "@/modules/delivery/domain/delivery";

export async function GET(req: NextRequest) {
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

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  if (!branchId) {
    return NextResponse.json({ error: "Branch context required" }, { status: 400 });
  }

  const status = url.searchParams.get("status") as any;
  const driverId = url.searchParams.get("driverId");
  let deliveries = await deliveryService.listDeliveries(tenantId, branchId, status);

  if (driverId) {
    deliveries = deliveries.filter((d) => d.driver_id === driverId);
  }

  // If driver role, minimize data (PHASE 00 Section 31)
  if (auth.session.role === "DRIVER") {
    const minimized = deliveries.map((d) => deliveryService.toDeliveryViewDTO(d));
    return NextResponse.json({ deliveries: minimized });
  }

  return NextResponse.json({ deliveries });
}

export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json();
    const branchId = body.branchId || auth.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch context required" }, { status: 400 });
    }

    const validated = createDeliverySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const delivery = await deliveryService.createDelivery({
      tenantId,
      branchId,
      orderId: validated.data.orderId,
      priority: validated.data.priority,
      deliveryAddress: validated.data.deliveryAddress,
      customerNotes: validated.data.customerNotes,
      deliveryNotes: validated.data.deliveryNotes,
    });

    return NextResponse.json({ delivery }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create delivery" }, { status: 400 });
  }
}
