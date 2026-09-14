import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { fleetService } from "@/modules/fleet/services/fleet-service";
import { z } from "zod";

const telemetryPacketSchema = z.object({
  trackerId: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  speedKmh: z.number().optional(),
  headingDegrees: z.number().optional(),
  batteryLevel: z.number().optional(),
  recordedAt: z.string().or(z.date()).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "telemetry.ingest")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = telemetryPacketSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await fleetService.ingestTelemetry(tenantId, {
      ...validated.data,
      recordedAt: validated.data.recordedAt || new Date(),
    });

    return NextResponse.json({ result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to ingest telemetry" }, { status: 400 });
  }
}
