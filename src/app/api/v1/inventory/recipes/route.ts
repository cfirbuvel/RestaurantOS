import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { recipeService } from "@/modules/inventory/services/recipe-service";
import { createRecipeSchema } from "@/modules/inventory/domain/inventory";

export async function GET(req: NextRequest) {
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

  const recipes = await recipeService.listRecipes(tenantId);
  return NextResponse.json({ recipes });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "recipes.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createRecipeSchema.parse(body);

    const recipe = await recipeService.createRecipe({
      tenantId,
      productId: validated.productId,
      variantId: validated.variantId,
      modifierId: validated.modifierId,
      name: validated.name,
      description: validated.description,
      yieldPortions: validated.yieldPortions,
      prepTimeMinutes: validated.prepTimeMinutes,
      isSubRecipe: validated.isSubRecipe,
      items: validated.items,
    });

    return NextResponse.json({ recipe }, { status: 201 });
  } catch (err: any) {
    if (err.errors) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to create recipe" }, { status: 400 });
  }
}
