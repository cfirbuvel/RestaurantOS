import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { loyaltyService } from "@/modules/marketing";
import { createLoyaltyProgramSchema } from "@/modules/marketing/domain/marketing";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const program = loyaltyService.getProgram(tenantId);
  return NextResponse.json({ program });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "loyalty.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const existing = loyaltyService.getProgram(tenantId);

    if (existing) {
      const updated = loyaltyService.updateProgram(tenantId, body);
      return NextResponse.json({ program: updated });
    } else {
      const validated = createLoyaltyProgramSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json(
          { error: "Validation failed", details: validated.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      const program = loyaltyService.createProgram(tenantId, validated.data);
      return NextResponse.json({ program }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to configure loyalty program" }, { status: 400 });
  }
}
