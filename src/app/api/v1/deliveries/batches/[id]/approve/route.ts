import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { batchingEngine } from "@/modules/delivery/services/batching-engine";
import { z } from "zod";

const approveBatchSchema = z.object({
  driverId: z.string().optional(),
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
    let body = {};
    try {
      body = await req.json();
    } catch {
      // body is optional
    }

    const validated = approveBatchSchema.safeParse(body);
    const driverId = validated.success ? validated.data.driverId : undefined;

    const batch = await batchingEngine.approveBatch({
      tenantId,
      batchId: id,
      managerUserId: auth.session.userId,
      driverId,
    });

    return NextResponse.json({ batch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to approve batch" }, { status: 400 });
  }
}
