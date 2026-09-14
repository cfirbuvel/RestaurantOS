import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { fleetService } from "@/modules/fleet/services/fleet-service";
import { z } from "zod";

const createVehicleSchema = z.object({
  vehicleType: z.enum(["BIKE", "SCOOTER", "SMALL_CAR", "MEDIUM_CAR", "LARGE_VAN", "TRUCK"]),
  licensePlate: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "fleet.read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  const branchId = auth.branchId;
  if (!tenantId || !branchId) {
    return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
  }

  try {
    const vehicles = await fleetService.listVehicles(tenantId, branchId);
    return NextResponse.json({ vehicles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list vehicles" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "fleet.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  const branchId = auth.branchId;
  if (!tenantId || !branchId) {
    return NextResponse.json({ error: "Tenant and branch context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createVehicleSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const vehicle = await fleetService.createVehicle(tenantId, branchId, validated.data);
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create vehicle" }, { status: 400 });
  }
}
