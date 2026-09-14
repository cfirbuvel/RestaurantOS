import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { menuService } from "@/modules/menu/services/menu-service";
import { createModifierGroupSchema } from "@/modules/menu/domain/menu";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "menu.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createModifierGroupSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const group = await menuService.createModifierGroup(tenantId, validated.data);
    return NextResponse.json({ modifierGroup: group }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create modifier group" }, { status: 400 });
  }
}
