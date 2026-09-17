import { NextRequest, NextResponse } from "next/server";
import { checkoutService } from "@/modules/public-ordering/services/checkout-service";
import { checkoutRequestSchema } from "@/modules/public-ordering/domain/checkout";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const body = await request.json();

    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_FAILED",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const response = await checkoutService.processCheckout(slug, parsed.data, ip);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process checkout",
      },
      { status: 400 }
    );
  }
}
