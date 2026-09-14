import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/modules/identity/services/auth-service";

const schema = z.object({
  token: z.string().min(1, "Token is required"),
});

/**
 * POST /api/v1/auth/verify-email
 *
 * Consumes a one-time email verification token and marks the account as verified.
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
    await authService.verifyEmail(parsed.data.token);
    return NextResponse.json(
      { message: "Email verified successfully." },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Email verification failed." },
      { status: 400 }
    );
  }
}
