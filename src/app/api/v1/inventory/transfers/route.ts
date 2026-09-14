import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { warehouseService } from "@/modules/inventory/services/warehouse-service";
import { createTransferSchema } from "@/modules/inventory/domain/inventory";

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

  const transfers = await warehouseService.listTransfers(tenantId);
  return NextResponse.json({ transfers });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "inventory.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createTransferSchema.parse(body);

    const transfer = await warehouseService.createTransfer({
      tenantId,
      sourceWarehouseId: validated.sourceWarehouseId,
      destinationWarehouseId: validated.destinationWarehouseId,
      requestedBy: auth.session.userId,
      notes: validated.notes,
      items: validated.items,
    });

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to create transfer" }, { status: 400 });
  }
}
