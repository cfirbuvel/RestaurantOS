import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { supplierService } from "@/modules/inventory/services/supplier-service";
import { receiveGoodsSchema } from "@/modules/inventory/domain/inventory";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "purchasing.manage") && !verifyPermission(auth.session, "inventory.adjust")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validated = receiveGoodsSchema.parse(body);

    const receipt = await supplierService.receiveGoods({
      tenantId,
      purchaseOrderId: id === "direct" ? undefined : id,
      warehouseId: validated.warehouseId,
      idempotencyKey: validated.idempotencyKey,
      receivedBy: auth.session.userId,
      notes: validated.notes,
      items: validated.items,
    });

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to receive goods" }, { status: 400 });
  }
}
