import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { inventoryService } from "@/modules/inventory/services/inventory-service";
import { updateIngredientSchema } from "@/modules/inventory/domain/inventory";

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
  const ingredient = await inventoryService.getIngredient(tenantId, id);
  if (!ingredient) {
    return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
  }

  return NextResponse.json({ ingredient });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  try {
    const body = await req.json();
    const validated = updateIngredientSchema.parse(body);

    const ingredient = await inventoryService.updateIngredient({
      tenantId,
      ingredientId: id,
      ...validated,
    });

    return NextResponse.json({ ingredient });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to update ingredient" }, { status: 400 });
  }
}
