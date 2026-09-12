import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/modules/identity/services/auth-service";
import { rateLimiter } from "@/core/security/rate-limiter";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateLimit = await rateLimiter.check(`login:${ip}`, {
      windowSeconds: 60,
      maxRequests: 10,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await authService.loginWithPassword(
      validated.data.email,
      validated.data.password,
      {
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || undefined,
        organizationId: validated.data.organizationId,
      }
    );

    const response = NextResponse.json({
      userId: result.user.id,
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
        expiresAt: result.session.expiresAt,
      },
    });

    // Set secure HttpOnly cookie
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
      { error: err?.message || "Invalid credentials" },
      { status: 401 }
    );
  }
}
