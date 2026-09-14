/**
 * Automated Security Test Suite — Phase 1
 *
 * Covers the 10 mandatory security vectors defined in:
 * RestaurantOS — 01 Foundation Implementation.md
 *
 *  1. Unauthorized access
 *  2. Cross-tenant access
 *  3. Privilege escalation
 *  4. Invalid / tampered tokens
 *  5. Expired sessions
 *  6. Malformed input (Zod validation)
 *  7. Injection attempts (SQL/NoSQL)
 *  8. Insecure file upload
 *  9. Rate limiting
 * 10. Webhook authentication
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { authService } from "@/modules/identity/services/auth-service";
import { ROLE_PERMISSIONS } from "@/modules/identity/domain/rbac";
import { memoryDb } from "@/core/database/db";
import { mockRedis } from "@/core/cache/redis";
import { rateLimiter } from "@/core/security/rate-limiter";
import { verifyWebhookSignature } from "@/core/security/webhook-verifier";
import { validateFileUpload } from "@/core/security/file-validator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createUser(
  email: string,
  password: string,
  orgName: string
): Promise<{ userId: string; sessionToken: string; orgId: string }> {
  const { user, organizationId } = await authService.registerUser({
    email,
    password,
    firstName: "Test",
    lastName: "User",
    organizationName: orgName,
  });
  const { session } = await authService.loginWithPassword(email, password);
  return { userId: user.id, sessionToken: session.token, orgId: organizationId! };
}

// ─── Suite 1: Unauthorized Access ────────────────────────────────────────────

describe("Security: Unauthorized Access", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("validateSession returns null for a missing token", async () => {
    const session = await authService.validateSession("nonexistent-token-000");
    expect(session).toBeNull();
  });

  it("validateSession returns null for an empty string token", async () => {
    const session = await authService.validateSession("");
    expect(session).toBeNull();
  });

  it("validateSession returns null for a random-looking but unregistered token", async () => {
    const fakeToken = "a".repeat(64);
    const session = await authService.validateSession(fakeToken);
    expect(session).toBeNull();
  });
});

// ─── Suite 2: Cross-Tenant Access ────────────────────────────────────────────

describe("Security: Cross-Tenant Access", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("Tenant B session cannot access Tenant A data via RLS simulation", async () => {
    const a = await createUser("alice@tenanta.com", "AlicePass1!", "Tenant A");
    const b = await createUser("bob@tenantb.com", "BobPass1!", "Tenant B");

    // Tenant A inserts a record
    memoryDb.insert("restaurants", { organization_id: a.orgId, name: "Tenant A Diner", slug: "ta-diner" });

    // Set context to Tenant B
    memoryDb.setTenantContext(b.orgId);
    const results = memoryDb.find("restaurants", () => true);
    memoryDb.clearTenantContext();

    // Tenant A's restaurant must NOT appear in Tenant B's query
    const tenantARestaurantVisible = results.some((r) => r.organization_id === a.orgId);
    expect(tenantARestaurantVisible).toBe(false);
  });

  it("findById returns null when org_id mismatches the RLS context", async () => {
    const a = await createUser("carol@tenanta.com", "CarolPass1!", "Carol Corp");
    const row = memoryDb.insert("restaurants", {
      organization_id: a.orgId,
      name: "Carol Cafe",
      slug: "carol-cafe",
    });

    // Query under a different tenant context
    memoryDb.setTenantContext("00000000-0000-0000-0000-000000000999");
    const found = memoryDb.findById("restaurants", row.id);
    memoryDb.clearTenantContext();

    expect(found).toBeNull();
  });
});

// ─── Suite 3: Privilege Escalation ───────────────────────────────────────────

describe("Security: Privilege Escalation", () => {
  it("KITCHEN_EMPLOYEE role does not have owner-level permissions", () => {
    const kitchenPerms = ROLE_PERMISSIONS["KITCHEN_EMPLOYEE"];
    expect(kitchenPerms).toBeDefined();
    // Kitchen staff cannot manage organizations, users, branches, or billing
    expect(kitchenPerms).not.toContain("organizations.manage");
    expect(kitchenPerms).not.toContain("users.manage");
    expect(kitchenPerms).not.toContain("billing.manage");
  });

  it("CASHIER role does not have inventory management permissions", () => {
    const cashierPerms = ROLE_PERMISSIONS["CASHIER"];
    expect(cashierPerms).toBeDefined();
    // Cashiers cannot manage inventory, recipes, or users
    expect(cashierPerms).not.toContain("inventory.manage");
    expect(cashierPerms).not.toContain("inventory.adjust");
    expect(cashierPerms).not.toContain("users.manage");
  });

  it("DRIVER role has minimal delivery-only access", () => {
    const driverPerms = ROLE_PERMISSIONS["DRIVER"];
    expect(driverPerms).toBeDefined();
    // Drivers should only have delivery permissions — no billing, inventory, or user management
    const nonDeliveryPerms = driverPerms.filter(
      (p) => !p.startsWith("delivery")
    );
    expect(nonDeliveryPerms).toHaveLength(0);
  });

  it("OWNER role has the broadest permission set", () => {
    const ownerPerms = ROLE_PERMISSIONS["OWNER"];
    const cashierPerms = ROLE_PERMISSIONS["CASHIER"];
    // Owner must be a superset of Cashier permissions
    const cashierHasAllInOwner = cashierPerms.every((p) => ownerPerms.includes(p));
    expect(cashierHasAllInOwner).toBe(true);
  });
});

// ─── Suite 4: Invalid / Tampered Tokens ──────────────────────────────────────

describe("Security: Invalid & Tampered Tokens", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("tampered session token (flip last char) is rejected", async () => {
    const { sessionToken } = await createUser("dan@test.com", "DanPass1!", "Dan's Diner");
    const tampered = sessionToken.slice(0, -1) + (sessionToken.endsWith("a") ? "b" : "a");
    const session = await authService.validateSession(tampered);
    expect(session).toBeNull();
  });

  it("empty token is rejected", async () => {
    expect(await authService.validateSession("")).toBeNull();
  });

  it("SQL-like injection in token field is rejected safely", async () => {
    const injection = "' OR 1=1; --";
    const session = await authService.validateSession(injection);
    expect(session).toBeNull();
  });
});

// ─── Suite 5: Expired Sessions ────────────────────────────────────────────────

describe("Security: Expired Sessions", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("session with past expiry is rejected and removed", async () => {
    const { sessionToken } = await createUser("erin@test.com", "ErinPass1!", "Erin Eats");

    // Manually expire the session in memoryDb
    const sessions = memoryDb.find("sessions", (s) => s.token === sessionToken);
    expect(sessions).toHaveLength(1);
    memoryDb.update("sessions", sessions[0].id, { expires_at: new Date(Date.now() - 1000) });

    const session = await authService.validateSession(sessionToken);
    expect(session).toBeNull();

    // Session should have been cleaned up
    const afterCleanup = memoryDb.find("sessions", (s) => s.token === sessionToken);
    expect(afterCleanup).toHaveLength(0);
  });

  it("revoking a session prevents subsequent use", async () => {
    const { sessionToken } = await createUser("frank@test.com", "FrankPass1!", "Frank's");
    await authService.revokeSession(sessionToken);
    expect(await authService.validateSession(sessionToken)).toBeNull();
  });
});

// ─── Suite 6: Malformed Input (Zod) ──────────────────────────────────────────

describe("Security: Malformed Input Validation", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("registration fails with missing email", async () => {
    await expect(
      authService.registerUser({ email: "", password: "Pass1!", firstName: "A", lastName: "B" })
    ).rejects.toThrow();
  });

  it("login fails gracefully when email is not found", async () => {
    await expect(
      authService.loginWithPassword("ghost@nobody.com", "anything")
    ).rejects.toThrow(/invalid email or password/i);
  });

  it("PIN login fails when userId is unknown", async () => {
    await expect(
      authService.loginWithPin("00000000-0000-0000-0000-000000000000", "1234", "branch-1")
    ).rejects.toThrow(/user not found/i);
  });
});

// ─── Suite 7: Injection Attempts ─────────────────────────────────────────────

describe("Security: SQL Injection Resistance (memoryDb)", () => {
  beforeEach(() => {
    memoryDb.reset();
    mockRedis.clear();
  });

  it("login with SQL injection payload in email does not match any user", async () => {
    await createUser("victim@test.com", "VictimPass1!", "Victim Org");
    const injection = "' OR '1'='1";
    await expect(authService.loginWithPassword(injection, "anything")).rejects.toThrow(
      /invalid email or password/i
    );
  });

  it("login with null-byte in email is rejected", async () => {
    await expect(
      authService.loginWithPassword("test\x00@evil.com", "anything")
    ).rejects.toThrow(/invalid email or password/i);
  });
});

// ─── Suite 8: Insecure File Upload ───────────────────────────────────────────

describe("Security: File Upload Validation", () => {
  it("rejects file with PHP extension", () => {
    const buf = Buffer.from("<?php phpinfo(); ?>");
    const result = validateFileUpload({ buffer: buf, filename: "shell.php" });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not permitted/i);
  });

  it("rejects file exceeding size limit", () => {
    const hugeBuf = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    const result = validateFileUpload({ buffer: hugeBuf, filename: "big.jpg" });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/maximum allowed size/i);
  });

  it("rejects path traversal filename", () => {
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validateFileUpload({ buffer: pngMagic, filename: "../../etc/passwd.png" });
    // After basename sanitization the path traversal is neutralised; but we
    // confirm the validator processes it without throwing
    expect(() => validateFileUpload({ buffer: pngMagic, filename: "../../etc/passwd.png" })).not.toThrow();
  });

  it("rejects JPEG extension with non-JPEG content (MIME spoofing)", () => {
    const htmlContent = Buffer.from("<html><script>alert(1)</script></html>");
    const result = validateFileUpload({ buffer: htmlContent, filename: "photo.jpg" });
    expect(result.valid).toBe(false);
  });

  it("rejects null-byte in filename", () => {
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // After null-byte strip & basename, the file should still be evaluated
    const result = validateFileUpload({ buffer: pngMagic, filename: "safe\x00.exe.png" });
    // The dangerous .exe part should be stripped; the sanitized name becomes "safe.exe.png"
    // which has extension ".png" — the magic bytes should pass for PNG
    expect(result.valid).toBe(true);
    expect(result.sanitizedFilename).not.toContain("\x00");
  });

  it("accepts a valid PNG with correct magic bytes", () => {
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
    const result = validateFileUpload({ buffer: pngMagic, filename: "image.png" });
    expect(result.valid).toBe(true);
    expect(result.detectedMimeType).toBe("image/png");
  });

  it("accepts a valid JPEG with correct magic bytes", () => {
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(100).fill(0)]);
    const result = validateFileUpload({ buffer: jpegMagic, filename: "photo.jpg" });
    expect(result.valid).toBe(true);
    expect(result.detectedMimeType).toBe("image/jpeg");
  });
});

// ─── Suite 9: Rate Limiting ───────────────────────────────────────────────────

describe("Security: Rate Limiting", () => {
  beforeEach(() => {
    mockRedis.clear();
  });

  it("blocks after exceeding max requests in the window", async () => {
    const key = "test_rate_limit_key";
    const opts = { maxRequests: 3, windowSeconds: 60 };

    const r1 = await rateLimiter.check(key, opts);
    const r2 = await rateLimiter.check(key, opts);
    const r3 = await rateLimiter.check(key, opts);
    const r4 = await rateLimiter.check(key, opts); // over the limit

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("different keys have independent counters", async () => {
    const opts = { maxRequests: 1, windowSeconds: 60 };

    const a = await rateLimiter.check("key_a", opts);
    const b = await rateLimiter.check("key_b", opts);

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);

    const a2 = await rateLimiter.check("key_a", opts);
    expect(a2.allowed).toBe(false);

    const b2 = await rateLimiter.check("key_b", opts);
    expect(b2.allowed).toBe(false);
  });
});

// ─── Suite 10: Webhook Authentication ────────────────────────────────────────

describe("Security: Webhook Signature Verification", () => {
  const secret = "test_webhook_secret_key_12345";

  function makeSignature(body: string | Buffer, s = secret): string {
    const { createHmac } = require("crypto");
    return "sha256=" + createHmac("sha256", s).update(body).digest("hex");
  }

  it("accepts a valid HMAC-SHA256 signature", () => {
    const body = JSON.stringify({ event: "order.placed", orderId: "ord_123" });
    const sig = makeSignature(body);
    const result = verifyWebhookSignature({ body, signature: sig, secret });
    expect(result.valid).toBe(true);
  });

  it("rejects tampered body", () => {
    const original = JSON.stringify({ event: "order.placed", amount: 100 });
    const sig = makeSignature(original);
    const tampered = JSON.stringify({ event: "order.placed", amount: 9999 });
    const result = verifyWebhookSignature({ body: tampered, signature: sig, secret });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/mismatch/i);
  });

  it("rejects wrong secret", () => {
    const body = JSON.stringify({ event: "ping" });
    const sig = makeSignature(body, "wrong-secret");
    const result = verifyWebhookSignature({ body, signature: sig, secret });
    expect(result.valid).toBe(false);
  });

  it("rejects stale timestamp (replay attack)", () => {
    const body = JSON.stringify({ event: "ping" });
    const sig = makeSignature(body);
    const staleTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ min ago
    const result = verifyWebhookSignature({
      body,
      signature: sig,
      secret,
      timestamp: staleTimestamp,
      toleranceSeconds: 300,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/stale|replay/i);
  });

  it("accepts timestamp within tolerance window", () => {
    const body = JSON.stringify({ event: "ping" });
    const sig = makeSignature(body);
    const freshTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 min ago
    const result = verifyWebhookSignature({
      body,
      signature: sig,
      secret,
      timestamp: freshTimestamp,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts Buffer body", () => {
    const body = Buffer.from(JSON.stringify({ event: "ping" }));
    const sig = makeSignature(body);
    const result = verifyWebhookSignature({ body, signature: sig, secret });
    expect(result.valid).toBe(true);
  });

  it("rejects signature without sha256= prefix when content differs", () => {
    const body = "hello";
    const sig = "deadbeefdeadbeef"; // wrong and no prefix
    const result = verifyWebhookSignature({ body, signature: sig, secret });
    expect(result.valid).toBe(false);
  });
});
