import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { menuService } from "@/modules/menu/services/menu-service";
import { createCategorySchema } from "@/modules/menu/domain/menu";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  const tenantId =
    auth?.organizationId ||
    req.headers.get("x-tenant-id") ||
    "1b9ca808-44c7-4fec-b94f-05c133c959f0"; // Fallback to primary seed tenant for public menu view

  const categories = await menuService.listCategories(tenantId);
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !verifyPermission(auth.session, "categories.manage") &&
    !verifyPermission(auth.session, "menu.manage")
  ) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createCategorySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const category = await menuService.createCategory(tenantId, validated.data);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create category" }, { status: 400 });
  }
}
