import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { batchingEngine } from "@/modules/delivery/services/batching-engine";
import { z } from "zod";

const rejectBatchSchema = z.object({
  reason: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "delivery.batch") && !verifyPermission(auth.session, "delivery.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validated = rejectBatchSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const batch = await batchingEngine.rejectBatch({
      tenantId,
      batchId: id,
      managerUserId: auth.session.userId,
      reason: validated.data.reason,
    });

    return NextResponse.json({ batch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reject batch" }, { status: 400 });
  }
}
