import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { batchingEngine } from "@/modules/delivery/services/batching-engine";
import { z } from "zod";

const suggestBatchesSchema = z.object({
  maxOrdersPerBatch: z.number().int().min(2).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "delivery.batch") && !verifyPermission(auth.session, "delivery.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  const branchId = auth.branchId;
  if (!tenantId || !branchId) {
    return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
  }

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      // body is optional
    }

    const validated = suggestBatchesSchema.safeParse(body);
    const maxOrdersPerBatch = validated.success ? validated.data.maxOrdersPerBatch : undefined;

    const batches = await batchingEngine.suggestBatches({
      tenantId,
      branchId,
      maxOrdersPerBatch,
    });

    return NextResponse.json({ batches });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to suggest batches" }, { status: 400 });
  }
}
