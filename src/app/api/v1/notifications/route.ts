import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { notificationService } from "@/modules/notifications/notification-service";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;
  const userId = auth.session.userId;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Tenant and user context required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit")) || 50;

  try {
    const notifications = await notificationService.getNotifications(tenantId, userId, limit);
    return NextResponse.json({ notifications });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load notifications" }, { status: 500 });
  }
}
