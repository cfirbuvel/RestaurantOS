import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { supplierService } from "@/modules/inventory/services/supplier-service";
import { createPurchaseOrderSchema } from "@/modules/inventory/domain/inventory";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "purchasing.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || auth.branchId || undefined;

  const purchaseOrders = await supplierService.listPurchaseOrders(tenantId, branchId);
  return NextResponse.json({ purchaseOrders });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "purchasing.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createPurchaseOrderSchema.parse(body);
    const branchId = body.branchId || auth.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch context required" }, { status: 400 });
    }

    const purchaseOrder = await supplierService.createPurchaseOrder({
      tenantId,
      branchId,
      supplierId: validated.supplierId,
      destinationWarehouseId: validated.destinationWarehouseId,
      expectedDeliveryDate: validated.expectedDeliveryDate,
      notes: validated.notes,
      createdBy: auth.session.userId,
      items: validated.items,
    });

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to create purchase order" }, { status: 400 });
  }
}
