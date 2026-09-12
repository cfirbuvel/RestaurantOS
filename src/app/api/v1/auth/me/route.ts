import { NextRequest, NextResponse } from "next/server";
import { resolveAuthContext } from "@/modules/identity/middleware/auth-guard";
import { memoryDb, getPostgresPool } from "@/core/database/db";

export async function GET(req: NextRequest) {
  const auth = await resolveAuthContext(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userRow: any;
  if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
    userRow = memoryDb.findById("users", auth.userId);
  } else {
    const pool = getPostgresPool();
    const res = await pool.query("SELECT * FROM users WHERE id = $1", [auth.userId]);
    userRow = res.rows[0];
  }

  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: userRow.id,
      email: userRow.email,
      firstName: userRow.first_name,
      lastName: userRow.last_name,
      phone: userRow.phone,
    },
    session: {
      id: auth.session.id,
      role: auth.session.role,
      permissions: auth.session.permissions,
      organizationId: auth.session.organizationId,
      branchId: auth.session.branchId,
      expiresAt: auth.session.expiresAt,
    },
  });
}
