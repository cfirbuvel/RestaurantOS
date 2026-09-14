import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/modules/identity/services/auth-service";
import { rateLimiter } from "@/core/security/rate-limiter";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * POST /api/v1/auth/forgot-password
 *
 * Initiates the password-reset flow.  Always responds with 200 OK to prevent
 * email enumeration — the caller cannot determine whether the address exists.
 *
 * Rate limited to 5 requests / 15 min per IP.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  const limitResult = await rateLimiter.check(`forgot_password:${ip}`, { maxRequests: 5, windowSeconds: 15 * 60 });
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }

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

  // Fire-and-forget – user enumeration is prevented inside the service
  await authService.requestPasswordReset(parsed.data.email);

  return NextResponse.json(
    { message: "If that email is registered, a password reset link has been sent." },
    { status: 200 }
  );
}
