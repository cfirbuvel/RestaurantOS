import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authService } from "@/modules/identity/services/auth-service";
import { rateLimiter } from "@/core/security/rate-limiter";
import { memoryDb, getPostgresPool } from "@/core/database/db";

const pinLoginSchema = z.object({
  userId: z.string().uuid().optional(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits"),
  branchId: z.string().uuid().optional(),
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
    let targetUserId = userId;
    let targetBranchId = branchId;

    // If userId not provided directly (e.g. fast PIN keypad login on mobile)
    if (!targetUserId) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const usersWithPin = memoryDb.find("users", (u: any) => u.pin_code_hash && u.is_active !== false);
        for (const u of usersWithPin) {
          if (bcrypt.compareSync(pin, u.pin_code_hash)) {
            targetUserId = u.id;
            break;
          }
        }
      } else {
        const pool = getPostgresPool();
        const usersRes = await pool.query(
          "SELECT id, pin_code_hash FROM users WHERE pin_code_hash IS NOT NULL AND is_active = true"
        );
        for (const row of usersRes.rows) {
          if (bcrypt.compareSync(pin, row.pin_code_hash)) {
            targetUserId = row.id;
            break;
          }
        }
      }

      if (!targetUserId) {
        return NextResponse.json(
          { error: "Invalid PIN code. Please check your credentials." },
          { status: 401 }
        );
      }
    }

    // Resolve branchId if not supplied
    if (!targetBranchId) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const assignments = memoryDb.find("user_branch_assignments", (a: any) => a.user_id === targetUserId);
        if (assignments.length > 0) {
          const primary = assignments.find((a: any) => a.is_primary) || assignments[0];
          targetBranchId = primary.branch_id;
        } else {
          const branches = memoryDb.find("branches", () => true);
          if (branches.length > 0) targetBranchId = branches[0].id;
        }
      } else {
        const pool = getPostgresPool();
        const branchRes = await pool.query(
          "SELECT branch_id FROM user_branch_assignments WHERE user_id = $1 ORDER BY is_primary DESC LIMIT 1",
          [targetUserId]
        );
        if (branchRes.rows.length > 0) {
          targetBranchId = branchRes.rows[0].branch_id;
        } else {
          const anyBranch = await pool.query("SELECT id FROM branches LIMIT 1");
          if (anyBranch.rows.length > 0) targetBranchId = anyBranch.rows[0].id;
        }
      }
    }

    // Rate limit per user PIN attempts
    const rateLimit = await rateLimiter.check(`pin_attempt:${targetUserId}`, {
      windowSeconds: 60,
      maxRequests: 5,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please slow down." },
        { status: 429 }
      );
    }

    const result = await authService.loginWithPin(targetUserId, pin, targetBranchId || "default-branch", {
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
