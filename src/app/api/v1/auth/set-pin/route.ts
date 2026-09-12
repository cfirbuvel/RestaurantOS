import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/modules/identity/services/auth-service";

const setPinSchema = z.object({
  userId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 numeric digits"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = setPinSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await authService.setUserPin(validated.data.userId, validated.data.pin);
    return NextResponse.json({
      success: true,
      message: "Terminal PIN configured successfully",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to set PIN" },
      { status: 400 }
    );
  }
}
