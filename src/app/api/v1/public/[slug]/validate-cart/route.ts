import { NextRequest, NextResponse } from "next/server";
import { checkoutService } from "@/modules/public-ordering/services/checkout-service";
import { publicRateLimiter } from "@/modules/public-ordering/security/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

    const rate = publicRateLimiter.check(`cart_${ip}`, 60, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "RATE_LIMIT_EXCEEDED: אנא המתן מספר רגעים" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const result = await checkoutService.validateCart(slug, {
      items: body.items || [],
      orderType: body.orderType || "DELIVERY",
      couponCode: body.couponCode,
      tipAmount: Number(body.tipAmount || 0),
    });

    return NextResponse.json({
      success: result.isValid,
      errors: result.errors,
      cart: result.cart,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to validate cart",
      },
      { status: 400 }
    );
  }
}
