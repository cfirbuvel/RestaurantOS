import { describe, it, expect, beforeEach } from "vitest";
import { authService } from "@/modules/identity/services/auth-service";
import { memoryDb } from "@/core/database/db";

describe("AuthService & Session Management", () => {
  beforeEach(() => {
    memoryDb.reset();
  });

  it("should successfully register a user and organization", async () => {
    const result = await authService.registerUser({
      email: "owner@restaurant.co.il",
      password: "StrongPassword123!",
      firstName: "David",
      lastName: "Cohen",
      organizationName: "David Burgers",
    });

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe("owner@restaurant.co.il");
    expect(result.organizationId).toBeDefined();

    const org = memoryDb.findById("organizations", result.organizationId!);
    expect(org.name).toBe("David Burgers");
    expect(org.status).toBe("ACTIVE");
  });

  it("should prevent registration with duplicate email", async () => {
    await authService.registerUser({
      email: "duplicate@restaurant.co.il",
      password: "StrongPassword123!",
      firstName: "Avi",
      lastName: "Levi",
    });

    await expect(
      authService.registerUser({
        email: "duplicate@restaurant.co.il",
        password: "AnotherPassword123!",
        firstName: "Avi",
        lastName: "Levi",
      })
    ).rejects.toThrow("User with this email already exists");
  });

  it("should authenticate with password and return valid session", async () => {
    await authService.registerUser({
      email: "manager@restaurant.co.il",
      password: "SuperSecretPassword123!",
      firstName: "Sara",
      lastName: "Shapira",
      organizationName: "Sara Pizza",
    });

    const loginRes = await authService.loginWithPassword(
      "manager@restaurant.co.il",
      "SuperSecretPassword123!"
    );

    expect(loginRes.session.token).toBeDefined();
    expect(loginRes.session.role).toBe("OWNER");
    expect(loginRes.session.permissions).toContain("orders.create");

    // Validate session token
    const session = await authService.validateSession(loginRes.session.token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(loginRes.user.id);

    // Revoke session (logout)
    await authService.revokeSession(loginRes.session.token);
    const revoked = await authService.validateSession(loginRes.session.token);
    expect(revoked).toBeNull();
  });

  it("should reject invalid passwords", async () => {
    await authService.registerUser({
      email: "user@restaurant.co.il",
      password: "CorrectPassword123!",
      firstName: "Dan",
      lastName: "Mor",
    });

    await expect(
      authService.loginWithPassword("user@restaurant.co.il", "WrongPassword123!")
    ).rejects.toThrow("Invalid email or password");
  });

  it("should authenticate with terminal PIN and lock out after 5 consecutive failures", async () => {
    const reg = await authService.registerUser({
      email: "cashier@restaurant.co.il",
      password: "Password123!",
      firstName: "Yossi",
      lastName: "Bar",
      organizationName: "Bar Cafe",
    });

    // Configure terminal PIN "1234"
    await authService.setUserPin(reg.user.id, "1234");

    // Create branch
    const branch = memoryDb.insert("branches", {
      organization_id: reg.organizationId,
      restaurant_id: crypto.randomUUID(),
      name: "Dizengoff Branch",
      slug: "dizengoff",
      is_active: true,
    });

    // Successful PIN login
    const pinLogin = await authService.loginWithPin(reg.user.id, "1234", branch.id);
    expect(pinLogin.session.token).toBeDefined();
    expect(pinLogin.session.branchId).toBe(branch.id);

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      await expect(
        authService.loginWithPin(reg.user.id, "9999", branch.id)
      ).rejects.toThrow(/attempts remaining/);
    }

    // 5th failed attempt -> locks account for 15 minutes
    await expect(
      authService.loginWithPin(reg.user.id, "9999", branch.id)
    ).rejects.toThrow(/Terminal PIN locked/);

    // Even with the correct PIN, it is now locked
    await expect(
      authService.loginWithPin(reg.user.id, "1234", branch.id)
    ).rejects.toThrow(/Terminal PIN locked/);
  });
});
