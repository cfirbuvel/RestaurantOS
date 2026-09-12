import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/modules/identity/services/auth-service";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  organizationName: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await authService.registerUser(validated.data);
    return NextResponse.json(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        organizationId: result.organizationId,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Registration failed" },
      { status: 400 }
    );
  }
}
