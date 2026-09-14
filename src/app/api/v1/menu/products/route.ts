import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { menuService } from "@/modules/menu/services/menu-service";
import { createProductSchema } from "@/modules/menu/domain/menu";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  const tenantId =
    auth?.organizationId ||
    req.headers.get("x-tenant-id") ||
    "1b9ca808-44c7-4fec-b94f-05c133c959f0";

  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const branchId =
    url.searchParams.get("branchId") ||
    auth?.branchId ||
    req.headers.get("x-branch-id") ||
    undefined;

  const products = await menuService.listProducts(tenantId, categoryId, branchId);
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !verifyPermission(auth.session, "products.manage") &&
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
    const validated = createProductSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const product = await menuService.createProduct(tenantId, validated.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create product" }, { status: 400 });
  }
}
