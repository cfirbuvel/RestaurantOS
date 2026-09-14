import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { supplierService } from "@/modules/inventory/services/supplier-service";
import { createSupplierSchema } from "@/modules/inventory/domain/inventory";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "suppliers.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const suppliers = await supplierService.listSuppliers(tenantId);
  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "suppliers.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createSupplierSchema.parse(body);

    const supplier = await supplierService.createSupplier({
      tenantId,
      name: validated.name,
      contactName: validated.contactName,
      email: validated.email,
      phone: validated.phone,
      paymentTerms: validated.paymentTerms,
      leadTimeDays: validated.leadTimeDays,
      taxId: validated.taxId,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to create supplier" }, { status: 400 });
  }
}
