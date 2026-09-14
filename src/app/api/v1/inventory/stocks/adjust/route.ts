import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { adjustStockSchema } from "@/modules/inventory/domain/inventory";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "inventory.adjust")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = adjustStockSchema.parse(body);

    const result = await inventoryService.adjustStock({
      tenantId,
      warehouseId: validated.warehouseId,
      ingredientId: validated.ingredientId,
      adjustmentQuantity: validated.adjustmentQuantity,
      unitId: validated.unitId,
      reason: validated.reason,
      referenceType: validated.referenceType,
      actorId: auth.session.userId,
    });

    return NextResponse.json({
      stock: result.stock,
      movement: result.movement,
    });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to adjust stock" }, { status: 400 });
  }
}
