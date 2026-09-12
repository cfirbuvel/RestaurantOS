import { NextRequest, NextResponse } from "next/server";
import { extractSessionToken } from "@/modules/identity/middleware/auth-guard";
import { authService } from "@/modules/identity/services/auth-service";

export async function POST(req: NextRequest) {
  const token = extractSessionToken(req.headers);
  if (token) {
    await authService.revokeSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "restaurant_os_session",
    value: "",
    path: "/",
    expires: new Date(0),
    httpOnly: true,
  });

  return response;
}
