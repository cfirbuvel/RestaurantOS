import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { notificationService } from "@/modules/notifications/notification-service";
import { NotificationType, NotificationPriority } from "@/shared/contracts/notifications";

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
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const branchId = url.searchParams.get("branchId") || auth.branchId;
  const type = url.searchParams.get("type") as NotificationType | undefined;
  const priority = url.searchParams.get("priority") as NotificationPriority | undefined;

  try {
    const notifications = await notificationService.getNotifications(tenantId, userId, limit, {
      branchId: branchId || undefined,
      unreadOnly,
      type,
      priority,
    });
    return NextResponse.json({ success: true, notifications });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to load notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = auth.organizationId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
  }

  // Only manager or admin can trigger manual notification broadcasts
  const role = auth.session.role;
  if (!role || !["OWNER", "ADMIN", "MANAGER", "DELIVERY_MANAGER", "KITCHEN_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions to dispatch notifications" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { recipientId, type, priority, title, body: messageBody, targetEntity, deepLink, branchId, deduplicationKey } = body;

    if (!recipientId || !title || !messageBody) {
      return NextResponse.json({ error: "Missing required fields (recipientId, title, body)" }, { status: 400 });
    }

    const envelope = await notificationService.dispatchActionableNotification({
      tenantId,
      branchId: branchId || auth.branchId || "default",
      recipientId,
      type: type || "MANAGER_MESSAGE",
      priority: priority || "MEDIUM",
      title,
      body: messageBody,
      targetEntity: targetEntity || { type: "ALERT", id: `alert_${Date.now()}` },
      deepLink,
      deduplicationKey,
    });

    return NextResponse.json({ success: true, notification: envelope });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to dispatch notification" }, { status: 500 });
  }
}
