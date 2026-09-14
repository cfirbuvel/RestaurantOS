import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { wasteService } from "@/modules/inventory/services/waste-service";
import { createWasteRecordSchema } from "@/modules/inventory/domain/inventory";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "waste.track") && !verifyPermission(auth.session, "inventory.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || auth.branchId || undefined;
  const warehouseId = url.searchParams.get("warehouseId") || undefined;

  const records = await wasteService.listWasteRecords(tenantId, branchId);
  const filtered = warehouseId ? records.filter((r) => r.warehouse_id === warehouseId) : records;
  const summary = await wasteService.getWasteSummary(tenantId, { branchId, warehouseId });

  return NextResponse.json({ records: filtered, summary });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "waste.track")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createWasteRecordSchema.parse(body);
    const branchId = body.branchId || auth.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch context required" }, { status: 400 });
    }

    const wasteRecord = await wasteService.recordWaste({
      tenantId,
      branchId,
      warehouseId: validated.warehouseId,
      ingredientId: validated.ingredientId,
      quantity: validated.quantity,
      unitId: validated.unitId,
      wasteReason: validated.wasteReason,
      notes: validated.notes,
      reportedBy: auth.session.userId,
    });

    return NextResponse.json({ wasteRecord }, { status: 201 });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to record waste" }, { status: 400 });
  }
}
