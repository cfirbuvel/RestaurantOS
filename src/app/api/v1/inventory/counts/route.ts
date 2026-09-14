import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { stockCountService } from "@/modules/inventory/services/stock-count-service";
import { createInventoryCountSchema } from "@/modules/inventory/domain/inventory";

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

  const counts = await stockCountService.getCounts(tenantId, warehouseId);
  return NextResponse.json({ counts });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "inventory.adjust") && !verifyPermission(auth.session, "inventory.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createInventoryCountSchema.parse(body);
    const branchId = body.branchId || auth.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch context required" }, { status: 400 });
    }

    const countSession = await stockCountService.createCountSession({
      tenantId,
      branchId,
      warehouseId: validated.warehouseId,
      countedBy: auth.session.userId,
      notes: validated.notes,
      items: validated.items,
    });

    return NextResponse.json({ count: countSession }, { status: 201 });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to record inventory count" }, { status: 400 });
  }
}
