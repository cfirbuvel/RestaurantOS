import { authService, Session } from "../services/auth-service";
import { Permission, Role, hasPermission } from "../domain/rbac";

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

  return {
    session,
    userId: session.userId,
    organizationId: session.organizationId,
    branchId: session.branchId,
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
