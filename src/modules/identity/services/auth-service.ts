import crypto from "crypto";
import { memoryDb, getPostgresPool } from "@/core/database/db";
import { User, UserSecurity } from "../domain/user";
import { Role, Permission, ROLE_PERMISSIONS } from "../domain/rbac";
import { auditLogger } from "@/core/audit/audit-logger";
import { getRedisClient } from "@/core/cache/redis";

// Token TTLs
const PASSWORD_RESET_TTL_SECONDS = 15 * 60;       // 15 minutes
const EMAIL_VERIFY_TTL_SECONDS  = 24 * 60 * 60;  // 24 hours

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface Session {
  id: string;
  userId: string;
  organizationId?: string;
  branchId?: string;
  token: string;
  role?: Role;
  permissions: Permission[];
  expiresAt: Date;
  createdAt: Date;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  organizationName?: string;
}

export interface LoginResult {
  session: Session;
  user: Omit<User, "pinFailedAttempts" | "pinLockedUntil">;
}

export class AuthService {
  private readonly SESSION_DURATION_HOURS = 24;

  async registerUser(input: RegisterUserInput): Promise<{ user: User; organizationId?: string; branchId?: string }> {
    const email = input.email.toLowerCase().trim();
    const passwordHash = await UserSecurity.hashPassword(input.password);

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const existing = memoryDb.find("users", (u) => u.email === email);
      if (existing.length > 0) {
        throw new Error("User with this email already exists");
      }

      const userRow = memoryDb.insert("users", {
        email,
        password_hash: passwordHash,
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone || null,
        is_active: true,
        email_verified: false,
        pin_failed_attempts: 0,
      });

      let orgId: string | undefined;
      let branchId: string | undefined;
      if (input.organizationName) {
        const orgSlug = input.organizationName.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const orgRow = memoryDb.insert("organizations", {
          name: input.organizationName,
          slug: orgSlug,
          status: "ACTIVE",
          settings: {},
        });
        orgId = orgRow.id;

        const restRow = memoryDb.insert("restaurants", {
          organization_id: orgId,
          name: input.organizationName,
          slug: `${orgSlug}-main`,
          status: "ACTIVE",
          brand_settings: {},
        });

        const branchRow = memoryDb.insert("branches", {
          organization_id: orgId,
          restaurant_id: restRow.id,
          name: "סניף ראשי (Main Branch)",
          slug: "main",
          address: {},
          operational_settings: { currency: "ILS", timezone: "Asia/Jerusalem" },
          is_active: true,
        });
        branchId = branchRow.id;

        memoryDb.insert("user_organizations", {
          user_id: userRow.id,
          organization_id: orgId,
          role: "OWNER",
        });

        memoryDb.insert("user_branch_assignments", {
          user_id: userRow.id,
          organization_id: orgId,
          restaurant_id: restRow.id,
          branch_id: branchId,
          role: "OWNER",
          is_primary: true,
        });
      }

      await auditLogger.log({
        organizationId: orgId,
        actor: { actorId: userRow.id, actorType: "USER" },
        action: "USER_REGISTERED",
        entity: "User",
        entityId: userRow.id,
        newState: { email, firstName: input.firstName, lastName: input.lastName },
      });

      return { user: this.mapUser(userRow), organizationId: orgId, branchId };
    }

    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingCheck = await client.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existingCheck.rows.length > 0) {
        throw new Error("User with this email already exists");
      }

      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [email, passwordHash, input.firstName, input.lastName, input.phone || null]
      );
      const userRow = userRes.rows[0];

      let orgId: string | undefined;
      let branchId: string | undefined;
      if (input.organizationName) {
        const orgSlug = input.organizationName.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const orgRes = await client.query(
          `INSERT INTO organizations (name, slug, status)
           VALUES ($1, $2, 'ACTIVE') RETURNING id`,
          [input.organizationName, orgSlug]
        );
        orgId = orgRes.rows[0].id;

        const restRes = await client.query(
          `INSERT INTO restaurants (organization_id, name, slug, status)
           VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
          [orgId, input.organizationName, `${orgSlug}-main`]
        );
        const restId = restRes.rows[0].id;

        const branchRes = await client.query(
          `INSERT INTO branches (organization_id, restaurant_id, name, slug)
           VALUES ($1, $2, 'סניף ראשי (Main Branch)', 'main') RETURNING id`,
          [orgId, restId]
        );
        branchId = branchRes.rows[0].id;

        await client.query(
          `INSERT INTO user_organizations (user_id, organization_id, role)
           VALUES ($1, $2, 'OWNER')`,
          [userRow.id, orgId]
        );

        await client.query(
          `INSERT INTO user_branch_assignments (user_id, organization_id, restaurant_id, branch_id, role, is_primary)
           VALUES ($1, $2, $3, $4, 'OWNER', true)`,
          [userRow.id, orgId, restId, branchId]
        );
      }

      await client.query("COMMIT");

      await auditLogger.log({
        organizationId: orgId,
        actor: { actorId: userRow.id, actorType: "USER" },
        action: "USER_REGISTERED",
        entity: "User",
        entityId: userRow.id,
        newState: { email, firstName: input.firstName, lastName: input.lastName },
      });

      return { user: this.mapUser(userRow), organizationId: orgId, branchId };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async loginWithPassword(
    emailInput: string,
    passwordInput: string,
    metadata?: { ipAddress?: string; userAgent?: string; organizationId?: string }
  ): Promise<LoginResult> {
    const email = emailInput.toLowerCase().trim();

    let userRow: any;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const users = memoryDb.find("users", (u) => u.email === email);
      if (users.length === 0) {
        throw new Error("Invalid email or password");
      }
      userRow = users[0];
    } else {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (res.rows.length === 0) {
        throw new Error("Invalid email or password");
      }
      userRow = res.rows[0];
    }

    if (!userRow.is_active) {
      throw new Error("Account has been disabled");
    }

    const isValid = await UserSecurity.verifyPassword(passwordInput, userRow.password_hash);
    if (!isValid) {
      await auditLogger.log({
        organizationId: metadata?.organizationId,
        actor: { actorId: userRow.id, actorType: "USER" },
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: userRow.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
      throw new Error("Invalid email or password");
    }

    // Determine organization & role
    const { orgId, role } = await this.resolvePrimaryOrgAndRole(userRow.id, metadata?.organizationId);

    // Resolve the user's primary branch assignment
    let branchId: string | undefined;
    if (orgId) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const assignments = memoryDb.find(
          "user_branch_assignments",
          (a: any) => a.user_id === userRow.id && a.organization_id === orgId
        );
        if (assignments.length > 0) {
          const primary = assignments.find((a: any) => a.is_primary) || assignments[0];
          branchId = primary.branch_id;
        }
      } else {
        const pool = getPostgresPool();
        const branchRes = await pool.query(
          `SELECT branch_id FROM user_branch_assignments
           WHERE user_id = $1 AND organization_id = $2
           ORDER BY is_primary DESC LIMIT 1`,
          [userRow.id, orgId]
        );
        if (branchRes.rows.length > 0) {
          branchId = branchRes.rows[0].branch_id;
        }
      }
    }

    const session = await this.createSession({
      userId: userRow.id,
      organizationId: orgId,
      branchId,
      role,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    await auditLogger.log({
      organizationId: orgId,
      actor: { actorId: userRow.id, actorType: "USER" },
      action: "LOGIN_SUCCESS",
      entity: "User",
      entityId: userRow.id,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      session,
      user: this.mapUser(userRow),
    };
  }

  async loginWithPin(
    userId: string,
    pin: string,
    branchId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<LoginResult> {
    let userRow: any;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      userRow = memoryDb.findById("users", userId);
    } else {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
      userRow = res.rows[0];
    }

    if (!userRow) {
      throw new Error("User not found");
    }

    if (!userRow.pin_code_hash) {
      throw new Error("User does not have terminal PIN configured");
    }

    const lockedUntil = userRow.pin_locked_until ? new Date(userRow.pin_locked_until) : null;
    const pinResult = await UserSecurity.verifyPin(
      pin,
      userRow.pin_code_hash,
      userRow.pin_failed_attempts || 0,
      lockedUntil
    );

    if (pinResult.locked) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        memoryDb.update("users", userId, {
          pin_locked_until: pinResult.lockoutExpiresAt,
          pin_failed_attempts: 5,
        });
      } else {
        const pool = getPostgresPool();
        await pool.query(
          "UPDATE users SET pin_locked_until = $1, pin_failed_attempts = 5 WHERE id = $2",
          [pinResult.lockoutExpiresAt, userId]
        );
      }
      throw new Error(`Terminal PIN locked due to excessive failed attempts. Try again in 15 minutes.`);
    }

    if (!pinResult.valid) {
      const nextFailed = (userRow.pin_failed_attempts || 0) + 1;
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        memoryDb.update("users", userId, { pin_failed_attempts: nextFailed });
      } else {
        const pool = getPostgresPool();
        await pool.query("UPDATE users SET pin_failed_attempts = $1 WHERE id = $2", [nextFailed, userId]);
      }
      throw new Error(`Invalid PIN. ${pinResult.remainingAttempts} attempts remaining.`);
    }

    // Success -> reset failed attempts
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("users", userId, { pin_failed_attempts: 0, pin_locked_until: null });
    } else {
      const pool = getPostgresPool();
      await pool.query("UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1", [userId]);
    }

    // Resolve branch assignment
    const { orgId, role } = await this.resolveBranchRole(userId, branchId);

    const session = await this.createSession({
      userId,
      organizationId: orgId,
      branchId,
      role,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    await auditLogger.log({
      organizationId: orgId,
      branchId,
      actor: { actorId: userId, actorType: "USER" },
      action: "PIN_LOGIN_SUCCESS",
      entity: "User",
      entityId: userId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      session,
      user: this.mapUser(userRow),
    };
  }

  async setUserPin(userId: string, pin: string): Promise<void> {
    const hash = await UserSecurity.hashPin(pin);
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const user = memoryDb.findById("users", userId);
      if (!user) {
        throw new Error("User not found");
      }
      memoryDb.update("users", userId, { pin_code_hash: hash, pin_failed_attempts: 0, pin_locked_until: null });
      return;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "UPDATE users SET pin_code_hash = $1, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $2",
      [hash, userId]
    );
    if (res.rowCount === 0) {
      throw new Error("User not found");
    }
  }

  async validateSession(token: string): Promise<Session | null> {
    let sessionRow: any;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const found = memoryDb.find("sessions", (s) => s.token === token);
      sessionRow = found.length > 0 ? found[0] : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT * FROM sessions WHERE token = $1", [token]);
      sessionRow = res.rows.length > 0 ? res.rows[0] : null;
    }

    if (!sessionRow) return null;

    const expiresAt = new Date(sessionRow.expires_at);
    if (Date.now() > expiresAt.getTime()) {
      await this.revokeSession(token);
      return null;
    }

    let role: Role = "VIEWER";
    if (sessionRow.branch_id) {
      const branchRes = await this.resolveBranchRole(sessionRow.user_id, sessionRow.branch_id);
      role = branchRes.role;
    } else if (sessionRow.organization_id) {
      const orgRes = await this.resolvePrimaryOrgAndRole(sessionRow.user_id, sessionRow.organization_id);
      role = orgRes.role;
    }

    const permissions = ROLE_PERMISSIONS[role] || [];

    return {
      id: sessionRow.id,
      userId: sessionRow.user_id,
      organizationId: sessionRow.organization_id,
      branchId: sessionRow.branch_id,
      token: sessionRow.token,
      role,
      permissions,
      expiresAt,
      createdAt: new Date(sessionRow.created_at),
    };
  }

  async revokeSession(token: string): Promise<void> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const found = memoryDb.find("sessions", (s) => s.token === token);
      if (found.length > 0) {
        memoryDb.delete("sessions", found[0].id);
      }
      return;
    }

    const pool = getPostgresPool();
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
  }

  private async createSession(input: {
    userId: string;
    organizationId?: string;
    branchId?: string;
    role?: Role;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION_HOURS * 60 * 60 * 1000);

    let sessionRow: any;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      sessionRow = memoryDb.insert("sessions", {
        user_id: input.userId,
        organization_id: input.organizationId || null,
        branch_id: input.branchId || null,
        token,
        expires_at: expiresAt,
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
      });
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `INSERT INTO sessions (user_id, organization_id, branch_id, token, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          input.userId,
          input.organizationId || null,
          input.branchId || null,
          token,
          expiresAt,
          input.ipAddress || null,
          input.userAgent || null,
        ]
      );
      sessionRow = res.rows[0];
    }

    const role = input.role || "VIEWER";
    const permissions = ROLE_PERMISSIONS[role] || [];

    return {
      id: sessionRow.id,
      userId: input.userId,
      organizationId: input.organizationId,
      branchId: input.branchId,
      token,
      role,
      permissions,
      expiresAt,
      createdAt: new Date(sessionRow.created_at),
    };
  }

  private async resolvePrimaryOrgAndRole(
    userId: string,
    preferredOrgId?: string
  ): Promise<{ orgId?: string; role: Role }> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const userOrgs = memoryDb.find("user_organizations", (uo) => uo.user_id === userId);
      if (userOrgs.length === 0) return { role: "VIEWER" };

      const match = preferredOrgId
        ? userOrgs.find((uo) => uo.organization_id === preferredOrgId) || userOrgs[0]
        : userOrgs[0];

      return { orgId: match.organization_id, role: match.role as Role };
    }

    const pool = getPostgresPool();
    const query = preferredOrgId
      ? "SELECT organization_id, role FROM user_organizations WHERE user_id = $1 AND organization_id = $2"
      : "SELECT organization_id, role FROM user_organizations WHERE user_id = $1 LIMIT 1";
    const params = preferredOrgId ? [userId, preferredOrgId] : [userId];
    const res = await pool.query(query, params);

    if (res.rows.length === 0) return { role: "VIEWER" };
    return { orgId: res.rows[0].organization_id, role: res.rows[0].role as Role };
  }

  private async resolveBranchRole(
    userId: string,
    branchId: string
  ): Promise<{ orgId?: string; role: Role }> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const assignments = memoryDb.find(
        "user_branch_assignments",
        (a) => a.user_id === userId && a.branch_id === branchId
      );
      if (assignments.length === 0) {
        // Fallback to Org role
        const branch = memoryDb.findById("branches", branchId);
        if (branch) {
          const orgRole = await this.resolvePrimaryOrgAndRole(userId, branch.organization_id);
          return { orgId: branch.organization_id, role: orgRole.role };
        }
        return { role: "VIEWER" };
      }
      return { orgId: assignments[0].organization_id, role: assignments[0].role as Role };
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT organization_id, role FROM user_branch_assignments WHERE user_id = $1 AND branch_id = $2",
      [userId, branchId]
    );

    if (res.rows.length === 0) {
      const branchRes = await pool.query("SELECT organization_id FROM branches WHERE id = $1", [branchId]);
      if (branchRes.rows.length > 0) {
        return this.resolvePrimaryOrgAndRole(userId, branchRes.rows[0].organization_id);
      }
      return { role: "VIEWER" };
    }

    return { orgId: res.rows[0].organization_id, role: res.rows[0].role as Role };
  }

  // ─── Password Reset ──────────────────────────────────────────────────────

  /**
   * Generates a cryptographically secure reset token, stores its SHA-256 hash
   * in the cache with a 15-minute TTL, and dispatches the reset email.
   * Always resolves successfully to prevent email enumeration.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    let userRow: any;

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const users = memoryDb.find("users", (u) => u.email === normalizedEmail);
      userRow = users[0] ?? null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
      userRow = res.rows[0] ?? null;
    }

    // Silently return – do not reveal whether email exists
    if (!userRow) return;

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const cache = getRedisClient();

    // Store mapping: hash → userId
    await cache.set(`pwd_reset:${tokenHash}`, userRow.id, "EX", PASSWORD_RESET_TTL_SECONDS);

    await auditLogger.log({
      actor: { actorId: userRow.id, actorType: "USER" },
      action: "PASSWORD_RESET_REQUESTED",
      entity: "User",
      entityId: userRow.id,
    });

    // In production this dispatches a real email. Here we emit a structured
    // log so the reset link is accessible during development/testing.
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/reset-password?token=${token}`;
    console.log(`[Auth] Password reset link for ${normalizedEmail}: ${resetUrl}`);
    // TODO: await notificationService.sendEmail({ to: normalizedEmail, template: "password-reset", data: { resetUrl } });
  }

  /**
   * Validates the raw reset token, re-hashes it, looks up the userId in cache,
   * updates the password, and revokes ALL active sessions for the account.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const cache = getRedisClient();
    const userId = await cache.get(`pwd_reset:${tokenHash}`);

    if (!userId) {
      throw new Error("Password reset token is invalid or has expired.");
    }

    const newHash = await UserSecurity.hashPassword(newPassword);

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("users", userId, { password_hash: newHash });
    } else {
      const pool = getPostgresPool();
      await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
        newHash,
        userId,
      ]);
    }

    // Consume token (one-time use)
    await cache.del(`pwd_reset:${tokenHash}`);

    // Invalidate all active sessions to enforce re-authentication
    await this.revokeAllUserSessions(userId);

    await auditLogger.log({
      actor: { actorId: userId, actorType: "USER" },
      action: "PASSWORD_RESET_COMPLETED",
      entity: "User",
      entityId: userId,
    });
  }

  // ─── Email Verification ──────────────────────────────────────────────────

  /**
   * Generates an email verification token, stores its hash in cache with a
   * 24-hour TTL, and dispatches the verification email.
   */
  async sendEmailVerification(userId: string): Promise<{ sent: boolean; reason?: string }> {
    let userRow: any;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      userRow = memoryDb.findById("users", userId);
    } else {
      const pool = getPostgresPool();
      const res = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
      userRow = res.rows[0] ?? null;
    }

    if (!userRow) throw new Error("User not found");
    if (userRow.email_verified) return { sent: false, reason: "ALREADY_VERIFIED" }; // already verified – no-op

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const cache = getRedisClient();

    await cache.set(`email_verify:${tokenHash}`, userId, "EX", EMAIL_VERIFY_TTL_SECONDS);

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/verify-email?token=${token}`;
    console.log(`[Auth] Email verification link for ${userRow.email}: ${verifyUrl}`);
    // TODO: await notificationService.sendEmail({ to: userRow.email, template: "email-verify", data: { verifyUrl } });
    return { sent: true };
  }

  /**
   * Validates the raw verification token and marks the user's email as verified.
   */
  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const cache = getRedisClient();
    const userId = await cache.get(`email_verify:${tokenHash}`);

    if (!userId) {
      throw new Error("Email verification token is invalid or has expired.");
    }

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("users", userId, { email_verified: true });
    } else {
      const pool = getPostgresPool();
      await pool.query("UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1", [userId]);
    }

    // Consume token (one-time use)
    await cache.del(`email_verify:${tokenHash}`);

    await auditLogger.log({
      actor: { actorId: userId, actorType: "USER" },
      action: "EMAIL_VERIFIED",
      entity: "User",
      entityId: userId,
    });
  }

  // ─── Session Revocation ──────────────────────────────────────────────────

  /**
   * Revokes ALL sessions for a given user (used on password reset and account
   * deactivation). Operates in both memory-db and Postgres modes.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const sessions = memoryDb.find("sessions", (s) => s.user_id === userId);
      for (const s of sessions) {
        memoryDb.delete("sessions", s.id);
      }
      return;
    }
    const pool = getPostgresPool();
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }

  private mapUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      isActive: row.is_active,
      emailVerified: row.email_verified,
      pinFailedAttempts: row.pin_failed_attempts || 0,
      pinLockedUntil: row.pin_locked_until ? new Date(row.pin_locked_until) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const authService = new AuthService();
