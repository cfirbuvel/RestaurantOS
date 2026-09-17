import { NextRequest, NextResponse } from "next/server";
import { publicMenuService } from "@/modules/public-ordering/services/public-menu-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    if (!slug) {
      return NextResponse.json({ error: "Missing restaurant slug" }, { status: 400 });
    }

    const data = await publicMenuService.getRestaurantPublicInfo(slug);

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to load restaurant info",
      },
      { status: 500 }
    );
  }
}
