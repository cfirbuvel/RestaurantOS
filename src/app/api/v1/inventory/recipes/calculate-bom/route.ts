import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { recipeService } from "@/modules/inventory/services/recipe-service";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "recipes.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { productId, variantId, modifierIds, selectedModifierIds, quantity, portions } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const bomCalculation = await recipeService.calculateBOM({
      tenantId,
      productId,
      variantId,
      selectedModifierIds: selectedModifierIds || modifierIds || [],
      quantity: quantity || portions || 1,
    });

    return NextResponse.json({ bom: bomCalculation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to calculate BOM" }, { status: 400 });
  }
}
