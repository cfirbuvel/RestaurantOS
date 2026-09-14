import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { kdsService } from "@/modules/kds/services/kds-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "kds.view")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }
  const { id } = await params;

  try {
    const ticket = await kdsService.startTicket(tenantId, id, auth.session.userId);
    return NextResponse.json({ ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to start ticket" }, { status: 400 });
  }
}
