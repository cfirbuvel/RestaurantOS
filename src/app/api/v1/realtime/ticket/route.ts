import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { getRedisClient } from "@/core/cache/redis";

export async function POST(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticketId = crypto.randomUUID();
  const redis = getRedisClient();

  const ticketData = {
    userId: auth.userId,
    organizationId: auth.organizationId,
    branchId: auth.branchId,
    role: auth.session.role,
    permissions: auth.session.permissions,
    createdAt: Date.now(),
  };

  // 60-second single-use ticket TTL
  await redis.set(`ticket:${ticketId}`, JSON.stringify(ticketData), "EX", 60);

  return NextResponse.json({
    ticket: ticketId,
    expiresInSeconds: 60,
  });
}
