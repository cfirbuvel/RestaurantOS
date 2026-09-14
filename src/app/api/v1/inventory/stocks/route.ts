import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { inventoryService } from "@/modules/inventory/services/inventory-service";

export async function GET(req: NextRequest) {
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

  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  const checkLowStock = url.searchParams.get("lowStock") === "true";

  if (checkLowStock && branchId) {
    const alerts = await inventoryService.getLowStockAlerts(tenantId, branchId);
    return NextResponse.json({ lowStockAlerts: alerts });
  }

  const stocks = await inventoryService.listStockLevels(tenantId, warehouseId);
  return NextResponse.json({ stocks });
}
