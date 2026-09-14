import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { warehouseService } from "@/modules/inventory/services/warehouse-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "inventory.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;
  const warehouse = await warehouseService.getWarehouse(tenantId, id);
  if (!warehouse) {
    return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  }

  return NextResponse.json({ warehouse });
}
