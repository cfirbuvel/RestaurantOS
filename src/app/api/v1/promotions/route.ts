import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { promotionEngine } from "@/modules/marketing";
import { createPromotionSchema } from "@/modules/marketing/domain/marketing";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "promotions.read") && !verifyPermission(auth.session, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const activeParam = url.searchParams.get("activeOnly");
  const branchId = url.searchParams.get("branchId") || undefined;
  const page = url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 50;

  const result = promotionEngine.listPromotions(tenantId, {
    branchId,
    isActive: activeParam != null ? activeParam === "true" : undefined,
    page,
    limit,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createPromotionSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const promotion = promotionEngine.createPromotion(tenantId, validated.data);
    return NextResponse.json({ promotion }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create promotion" }, { status: 400 });
  }
}
