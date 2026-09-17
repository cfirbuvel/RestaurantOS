import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { couponService } from "@/modules/marketing";
import { redeemCouponSchema } from "@/modules/marketing/domain/marketing";

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
    const validated = redeemCouponSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { couponCode, customerId, orderId, orderSubtotal, branchId, channel } = validated.data;
    const redemption = couponService.redeemCoupon(
      tenantId,
      couponCode,
      customerId,
      orderId,
      orderSubtotal,
      branchId,
      channel
    );

    return NextResponse.json({ redemption }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to redeem coupon" }, { status: 400 });
  }
}
