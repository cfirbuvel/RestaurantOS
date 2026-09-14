import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/modules/identity/services/auth-service";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { rateLimiter } from "@/core/security/rate-limiter";

/**
 * POST /api/v1/auth/resend-verification
 *
 * Re-dispatches the email verification link to the currently authenticated user.
 * Requires a valid session cookie or Bearer token. Rate limited to 3 requests / 10 min per user.
 */
export async function POST(request: NextRequest) {
  const auth = await resolveAuthContext(request.headers);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const limitResult = await rateLimiter.check(`resend_verify:${auth.userId}`, { maxRequests: 3, windowSeconds: 10 * 60 });
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }

  const result = await authService.sendEmailVerification(auth.userId);
  if (!result.sent && result.reason === "ALREADY_VERIFIED") {
    return NextResponse.json(
      { message: "This account's email address is already verified." },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { message: "Verification email has been sent." },
    { status: 200 }
  );
}
