import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/modules/identity/services/auth-service";

const schema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

/**
 * POST /api/v1/auth/reset-password
 *
 * Consumes a one-time reset token and sets a new password.
 * Revokes all active sessions upon success.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    await authService.resetPassword(parsed.data.token, parsed.data.newPassword);
    return NextResponse.json(
      { message: "Password has been reset successfully. Please log in again." },
      { status: 200 }
    );
  } catch (err: any) {
    // Intentionally vague to avoid token oracle attacks
    return NextResponse.json(
      { error: err.message ?? "Password reset failed." },
      { status: 400 }
    );
  }
}
