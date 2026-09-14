import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { kdsService } from "@/modules/kds/services/kds-service";
import { createStationSchema } from "@/modules/kds/domain/kds";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "kds.view")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const url = new URL(req.url);
  const tenantId = auth.organizationId;
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  if (!tenantId || !branchId) {
    return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
  }

  const stations = await kdsService.getStationsForBranch(tenantId, branchId);
  return NextResponse.json({ stations });
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "kds.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;

  try {
    const body = await req.json();
    const branchId = body.branchId || auth.branchId;
    if (!tenantId || !branchId) {
      return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
    }
    const validated = createStationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const station = await kdsService.createStation(tenantId, branchId, validated.data);
    return NextResponse.json({ station }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create station" }, { status: 400 });
  }
}
