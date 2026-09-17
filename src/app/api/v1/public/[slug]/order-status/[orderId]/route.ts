import { NextRequest, NextResponse } from "next/server";
import { checkoutService } from "@/modules/public-ordering/services/checkout-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await context.params;
    const token = request.nextUrl.searchParams.get("token") || undefined;

    const data = await checkoutService.getOrderStatus(slug, orderId, token);
    if (!data) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get order status",
      },
      { status: 500 }
    );
  }
}
