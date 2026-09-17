import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { promotionEngine } from "@/modules/marketing";
import { evaluatePromotionsSchema } from "@/modules/marketing/domain/marketing";

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
    const validated = evaluatePromotionsSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const orderContext = {
      tenantId,
      branchId: validated.data.branchId,
      channel: validated.data.channel,
      orderType: validated.data.orderType,
      customerId: validated.data.customerId,
      customerProfile: validated.data.customerProfile,
      items: validated.data.items,
      subtotal: validated.data.subtotal,
      couponCode: validated.data.couponCode,
    };

    const evaluation = promotionEngine.evaluatePromotions(orderContext);
    return NextResponse.json(evaluation);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to evaluate promotions" }, { status: 400 });
  }
}
