import { authService, Session } from "../services/auth-service";
import { Permission, Role, hasPermission } from "../domain/rbac";
import { memoryDb, getPostgresPool } from "@/core/database/db";

export interface AuthContext {
  session: Session;
  organizationId?: string;
  branchId?: string;
  userId: string;
}

export function extractSessionToken(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  // 1. Check Authorization header: Bearer <token>
  const authHeader =
    typeof (headers as any).get === "function"
      ? (headers as Headers).get("authorization")
      : (headers as any)["authorization"];

  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
  }

  // 2. Check Cookie header: restaurant_os_session=<token>
  const cookieHeader =
    typeof (headers as any).get === "function"
      ? (headers as Headers).get("cookie")
      : (headers as any)["cookie"];

  if (cookieHeader && typeof cookieHeader === "string") {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith("restaurant_os_session=")) {
        return c.substring("restaurant_os_session=".length);
      }
    }
  }

  return null;
}

export async function resolveAuthContext(headers: Headers | Record<string, string | string[] | undefined>): Promise<AuthContext | null> {
  const token = extractSessionToken(headers);
  if (!token) return null;

  const session = await authService.validateSession(token);
  if (!session) return null;

  let branchId = session.branchId;

  // If not explicitly bound to session, check x-branch-id header
  if (!branchId) {
    const xBranch =
      typeof (headers as any).get === "function"
        ? (headers as Headers).get("x-branch-id")
        : (headers as any)["x-branch-id"];
    if (xBranch && typeof xBranch === "string") {
      branchId = xBranch;
    }
  }

  // If still not present, resolve user's primary or first branch assignment
  if (!branchId && session.organizationId) {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const assignments = memoryDb.find(
        "user_branch_assignments",
        (a: any) => a.user_id === session.userId && a.organization_id === session.organizationId
      );
      if (assignments.length > 0) {
        const primary = assignments.find((a: any) => a.is_primary) || assignments[0];
        branchId = primary.branch_id;
      }
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT branch_id FROM user_branch_assignments
         WHERE user_id = $1 AND organization_id = $2
         ORDER BY is_primary DESC LIMIT 1`,
        [session.userId, session.organizationId]
      );
      if (res.rows.length > 0) {
        branchId = res.rows[0].branch_id;
      }
    }
  }

  return {
    session,
    userId: session.userId,
    organizationId: session.organizationId,
    branchId,
  };
}

export function verifyPermission(session: Session, permission: Permission): boolean {
  if (!session.role) return false;
  return hasPermission(session.role, permission);
}

export function verifyRole(session: Session, allowedRoles: Role[]): boolean {
  if (!session.role) return false;
  return allowedRoles.includes(session.role);
}
