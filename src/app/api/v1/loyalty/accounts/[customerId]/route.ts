import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { loyaltyService } from "@/modules/marketing";
import { LOYALTY_TIER_LABELS } from "@/modules/marketing/domain/marketing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  const { customerId } = await params;
  const account = loyaltyService.getOrCreateAccount(tenantId, customerId);

  return NextResponse.json({
    account,
    tierLabelHe: LOYALTY_TIER_LABELS[account.current_tier],
  });
}
