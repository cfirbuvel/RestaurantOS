import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { couponService } from "@/modules/marketing";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { code, customerId, orderSubtotal, branchId, channel } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }

    if (orderSubtotal == null || typeof orderSubtotal !== "number" || orderSubtotal < 0) {
      return NextResponse.json({ error: "Valid orderSubtotal is required" }, { status: 400 });
    }

    const result = couponService.validateCouponCode(
      tenantId,
      code,
      customerId ?? null,
      orderSubtotal,
      branchId ?? "",
      channel ?? "WEB"
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to validate coupon" }, { status: 400 });
  }
}
