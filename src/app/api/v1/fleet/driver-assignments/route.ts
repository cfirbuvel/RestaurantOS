import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { fleetService } from "@/modules/fleet/services/fleet-service";
import { z } from "zod";

const assignDriverSchema = z.object({
  driverUserId: z.string().min(1),
  vehicleId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "fleet.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = assignDriverSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const assignment = await fleetService.assignDriverToVehicle(
      tenantId,
      validated.data.driverUserId,
      validated.data.vehicleId,
      auth.session.userId
    );

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to assign driver to vehicle" }, { status: 400 });
  }
}
