import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { deliveryService } from "@/modules/delivery/services/delivery-service";
import { failDeliverySchema } from "@/modules/delivery/domain/delivery";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "driver.operate") && !verifyPermission(auth.session, "delivery.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validated = failDeliverySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const delivery = await deliveryService.failDelivery(
      tenantId,
      id,
      auth.session.userId,
      validated.data.reason
    );

    return NextResponse.json({ delivery });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to mark delivery failed" }, { status: 400 });
  }
}
