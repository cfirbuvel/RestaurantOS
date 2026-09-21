import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { branchService } from "@/modules/identity/domain/branch";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow users with branches.read or any operational/management permission
  const hasBranchAccess =
    verifyPermission(auth.session, "branches.read") ||
    verifyPermission(auth.session, "orders.read") ||
    verifyPermission(auth.session, "delivery.read");

  if (!hasBranchAccess) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId") || undefined;

  try {
    const branches = await branchService.listBranches(tenantId, restaurantId);
    return NextResponse.json({
      branches: branches.map((b) => ({
        id: b.id,
        restaurantId: b.restaurantId,
        organizationId: b.organizationId,
        name: b.name,
        slug: b.slug,
        address: b.address,
        phone: b.phone,
        operationalSettings: b.operationalSettings,
        isActive: b.isActive,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list branches" }, { status: 500 });
  }
}
