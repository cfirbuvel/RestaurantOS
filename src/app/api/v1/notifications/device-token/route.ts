import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { notificationService } from "@/modules/notifications/notification-service";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = auth.session.userId;
  if (!userId) {
    return NextResponse.json({ error: "User context required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { token, platform } = body;
    if (!token) {
      return NextResponse.json({ error: "Device token is required" }, { status: 400 });
    }

    await notificationService.registerDeviceToken(userId, token, platform || "ANDROID");
    return NextResponse.json({ success: true, message: "Device token registered successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to register device token" }, { status: 500 });
  }
}
