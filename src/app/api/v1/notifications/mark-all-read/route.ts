import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { notificationService } from "@/modules/notifications/notification-service";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;
  const userId = auth.session.userId;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Tenant and user context required" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const branchId = body.branchId || auth.branchId;

    const count = await notificationService.markAllAsRead(tenantId, userId, branchId);
    return NextResponse.json({ success: true, count, message: `${count} notifications marked as read` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to mark notifications as read" }, { status: 500 });
  }
}
