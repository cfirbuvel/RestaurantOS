import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { recipeService } from "@/modules/inventory/services/recipe-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const recipe = await recipeService.getRecipe(tenantId, id);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({ recipe });
}
