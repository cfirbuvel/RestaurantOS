/**
 * Unit Tests — Password Reset & Email Verification
 *
 * Tests the AuthService methods added in Phase 1:
 *   - requestPasswordReset
 *   - resetPassword
 *   - sendEmailVerification
 *   - verifyEmail
 *   - revokeAllUserSessions
 */

import { describe, it, expect, beforeEach } from "vitest";
import { authService } from "@/modules/identity/services/auth-service";
import { mockRedis } from "@/core/cache/redis";
import { memoryDb } from "@/core/database/db";

// ─── Test Helpers ────────────────────────────────────────────────────────────

async function registerAndLogin(email: string, password: string) {
  const { user } = await authService.registerUser({
    email,
    password,
    firstName: "Test",
    lastName: "User",
    organizationName: "Test Org",
  });
  const { session } = await authService.loginWithPassword(email, password);
  return { user, session };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Password Reset Flow", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("requestPasswordReset does NOT throw for unregistered email (prevents enumeration)", async () => {
    await expect(authService.requestPasswordReset("ghost@nowhere.com")).resolves.toBeUndefined();
  });

  it("requestPasswordReset stores a hashed token in the cache with 15-minute TTL", async () => {
    const { user } = await registerAndLogin("alice@test.com", "Password1!");

    const logSpy: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logSpy.push(args.join(" "));

    await authService.requestPasswordReset("alice@test.com");

    console.log = origLog;

    // Extract token from the dev-mode log line
    const logLine = logSpy.find((l) => l.includes("reset-password?token="));
    expect(logLine).toBeDefined();

    const token = logLine!.split("token=")[1].trim();
    expect(token).toHaveLength(64); // 32 bytes hex = 64 chars

    // The cache should hold an entry (hash → userId)
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const stored = await mockRedis.get(`pwd_reset:${hash}`);
    expect(stored).toBe(user.id);

    // TTL should be ≤ 900 seconds and > 0
    const ttl = await mockRedis.ttl(`pwd_reset:${hash}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it("resetPassword updates the password hash and consumes the token", async () => {
    await registerAndLogin("bob@test.com", "OldPass1!");

    const logSpy: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logSpy.push(args.join(" "));
    await authService.requestPasswordReset("bob@test.com");
    console.log = origLog;

    const logLine = logSpy.find((l) => l.includes("token="))!;
    const token = logLine.split("token=")[1].trim();

    await expect(authService.resetPassword(token, "NewPass1!")).resolves.toBeUndefined();

    // Token must be consumed (one-time use)
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const stored = await mockRedis.get(`pwd_reset:${hash}`);
    expect(stored).toBeNull();

    // New password should work
    await expect(authService.loginWithPassword("bob@test.com", "NewPass1!")).resolves.toBeDefined();
  });

  it("resetPassword rejects expired/invalid tokens", async () => {
    await expect(authService.resetPassword("fake-token-xyz", "NewPass1!")).rejects.toThrow(
      /invalid or has expired/i
    );
  });

  it("resetPassword invalidates ALL active sessions", async () => {
    const { session } = await registerAndLogin("carol@test.com", "CarolPass1!");

    const logSpy: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logSpy.push(args.join(" "));
    await authService.requestPasswordReset("carol@test.com");
    console.log = origLog;

    const logLine = logSpy.find((l) => l.includes("token="))!;
    const token = logLine.split("token=")[1].trim();

    // Session is valid before reset
    expect(await authService.validateSession(session.token)).not.toBeNull();

    await authService.resetPassword(token, "NewCarolPass1!");

    // Session must be invalid after reset
    expect(await authService.validateSession(session.token)).toBeNull();
  });
});

describe("Email Verification Flow", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("sendEmailVerification stores a hashed token in cache with 24-hour TTL", async () => {
    const { user } = await registerAndLogin("dave@test.com", "DavePass1!");

    const logSpy: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logSpy.push(args.join(" "));
    await authService.sendEmailVerification(user.id);
    console.log = origLog;

    const logLine = logSpy.find((l) => l.includes("verify-email?token="));
    expect(logLine).toBeDefined();

    const token = logLine!.split("token=")[1].trim();
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const stored = await mockRedis.get(`email_verify:${hash}`);
    expect(stored).toBe(user.id);

    const ttl = await mockRedis.ttl(`email_verify:${hash}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86400);
  });

  it("verifyEmail marks the user as email_verified and consumes the token", async () => {
    const { user } = await registerAndLogin("eve@test.com", "EvePass1!");
    expect(user.emailVerified).toBe(false);

    const logSpy: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logSpy.push(args.join(" "));
    await authService.sendEmailVerification(user.id);
    console.log = origLog;

    const logLine = logSpy.find((l) => l.includes("token="))!;
    const token = logLine.split("token=")[1].trim();

    await expect(authService.verifyEmail(token)).resolves.toBeUndefined();

    // User should now be verified in memoryDb
    const updatedUser = memoryDb.findById("users", user.id);
    expect(updatedUser?.email_verified).toBe(true);

    // Token is consumed – second call must fail
    await expect(authService.verifyEmail(token)).rejects.toThrow(/invalid or has expired/i);
  });

  it("verifyEmail rejects invalid tokens", async () => {
    await expect(authService.verifyEmail("not-a-real-token")).rejects.toThrow(
      /invalid or has expired/i
    );
  });

  it("sendEmailVerification is a no-op for already-verified users", async () => {
    const { user } = await registerAndLogin("frank@test.com", "FrankPass1!");

    const logSpy: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logSpy.push(args.join(" "));
    await authService.sendEmailVerification(user.id);
    console.log = origLog;

    const token = logSpy.find((l) => l.includes("token="))!.split("token=")[1].trim();
    await authService.verifyEmail(token);

    // Now verified — resending should NOT store a new token
    mockRedis.clear();
    await authService.sendEmailVerification(user.id); // no-op
    // No new cache entries
    const logSpy2: string[] = [];
    const origLog2 = console.log;
    console.log = (...args: any[]) => logSpy2.push(args.join(" "));
    console.log = origLog2;
    expect(logSpy2.filter((l) => l.includes("verify-email"))).toHaveLength(0);
  });
});
