import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/modules/identity/services/auth-service";
import { rateLimiter } from "@/core/security/rate-limiter";

const pinLoginSchema = z.object({
  userId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits"),
  branchId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const body = await req.json();
    const validated = pinLoginSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { userId, pin, branchId } = validated.data;

    // Rate limit per user PIN attempts
    const rateLimit = await rateLimiter.check(`pin_attempt:${userId}`, {
      windowSeconds: 60,
      maxRequests: 5,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please slow down." },
        { status: 429 }
      );
    }

    const result = await authService.loginWithPin(userId, pin, branchId, {
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    const response = NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      session: {
        id: result.session.id,
        token: result.session.token,
        role: result.session.role,
        permissions: result.session.permissions,
        branchId: result.session.branchId,
        expiresAt: result.session.expiresAt,
      },
    });

    response.cookies.set({
      name: "restaurant_os_session",
      value: result.session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "PIN verification failed" },
      { status: 401 }
    );
  }
}
