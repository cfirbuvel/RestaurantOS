import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { notificationService } from "@/modules/notifications/notification-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
  }

  const tenantId = auth.organizationId;
  const userId = auth.session.userId;

  try {
    const success = await notificationService.markAsRead(id, tenantId, userId);
    if (!success) {
      return NextResponse.json({ error: "Notification not found or access denied" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Notification marked as read" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to update notification" }, { status: 500 });
  }
}
