import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext, verifyPermission } from "@/modules/identity/middleware/auth-guard";
import { campaignService } from "@/modules/marketing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyPermission(auth.session, "campaigns.manage")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const customers = body.customers || [];
    const message = body.message || "";
    const channels = body.channels || ["SMS"];

    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json(
        { error: "Customers must be a non-empty array of objects with id, phone, email" },
        { status: 400 }
      );
    }

    const dispatches = await campaignService.dispatchCampaign(tenantId, id, customers, message, channels);
    return NextResponse.json({ dispatches, dispatchedCount: dispatches.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to dispatch campaign" }, { status: 400 });
  }
}
