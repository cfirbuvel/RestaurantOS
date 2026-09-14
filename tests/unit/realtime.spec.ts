import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { realtimeService } from "@/modules/realtime/services/realtime-service";

describe("Realtime Infrastructure & Ephemeral Ticket Auth", () => {
  const tenantId = "1b9ca808-44c7-4fec-b94f-05c133c959f0";
  const branchId = "be7c3e30-b28b-4d23-9d78-b56b545351f5";
  const userId = "c0ccd37f-a43a-4365-9093-d4158ee0f749";

  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seedDevData();
  });

  describe("Ephemeral Ticket Lifecycle (PHASE 00 Section 28)", () => {
    it("should issue a 60s ephemeral single-use ticket for authorized user", async () => {
      const res = await realtimeService.issueTicket({
        tenantId,
        branchId,
        userId,
        role: "KITCHEN_EMPLOYEE",
        stationId: "st-01-burgers",
      });

      expect(res.ticket).toBeDefined();
      expect(res.ticket.startsWith("tk_")).toBe(true);
      expect(res.channel).toBe(`branch:${branchId}:kds:st-01-burgers`);
      expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("should allow consuming a valid ticket exactly once", async () => {
      const issued = await realtimeService.issueTicket({
        tenantId,
        branchId,
        userId,
        role: "KITCHEN_EMPLOYEE",
      });

      // First consumption succeeds
      const consumed = await realtimeService.validateAndConsumeTicket(issued.ticket);
      expect(consumed.ticket).toBe(issued.ticket);
      expect(consumed.user_id).toBe(userId);
      expect(consumed.used_at).toBeDefined();

      // Second consumption must fail (single-use enforcement)
      await expect(
        realtimeService.validateAndConsumeTicket(issued.ticket)
      ).rejects.toThrow("Ticket has already been consumed (single-use)");
    });

    it("should reject expired tickets", async () => {
      const issued = await realtimeService.issueTicket({
        tenantId,
        branchId,
        userId,
        role: "KITCHEN_EMPLOYEE",
        ttlSeconds: -1, // Already expired
      });

      await expect(
        realtimeService.validateAndConsumeTicket(issued.ticket)
      ).rejects.toThrow("Ticket has expired");
    });

    it("should reject non-existent or invalid tickets", async () => {
      await expect(
        realtimeService.validateAndConsumeTicket("tk_fake_does_not_exist")
      ).rejects.toThrow("Invalid or non-existent ticket");
    });
  });

  describe("Realtime Channel Security Boundaries (PHASE 00 Section 29)", () => {
    it("KITCHEN_EMPLOYEE can subscribe to KDS station and all KDS channels", () => {
      const canAccessKdsStation = realtimeService.canAccessChannel(
        "KITCHEN_EMPLOYEE",
        branchId,
        `branch:${branchId}:kds:st-01-burgers`,
        "st-01-burgers"
      );
      expect(canAccessKdsStation).toBe(true);

      const canAccessAllKds = realtimeService.canAccessChannel(
        "KITCHEN_EMPLOYEE",
        branchId,
        `branch:${branchId}:kds:all`
      );
      expect(canAccessAllKds).toBe(true);
    });

    it("KITCHEN_EMPLOYEE cannot subscribe to dispatch or admin channels", () => {
      const canAccessDispatch = realtimeService.canAccessChannel(
        "KITCHEN_EMPLOYEE",
        branchId,
        `branch:${branchId}:dispatch`
      );
      expect(canAccessDispatch).toBe(false);

      const canAccessAdmin = realtimeService.canAccessChannel(
        "KITCHEN_EMPLOYEE",
        branchId,
        `branch:${branchId}:admin`
      );
      expect(canAccessAdmin).toBe(false);
    });

    it("DRIVER cannot subscribe to KDS channels or unrelated branch channels", () => {
      const canAccessKds = realtimeService.canAccessChannel(
        "DRIVER",
        branchId,
        `branch:${branchId}:kds:all`
      );
      expect(canAccessKds).toBe(false);

      const canAccessDispatch = realtimeService.canAccessChannel(
        "DRIVER",
        branchId,
        `branch:${branchId}:dispatch`
      );
      expect(canAccessDispatch).toBe(false);

      // Driver can only access their personal driver channel
      const canAccessSelf = realtimeService.canAccessChannel(
        "DRIVER",
        branchId,
        `branch:${branchId}:driver:me`
      );
      expect(canAccessSelf).toBe(true);
    });

    it("MANAGER has broader access across KDS, dispatch, and admin channels", () => {
      expect(
        realtimeService.canAccessChannel("MANAGER", branchId, `branch:${branchId}:kds:all`)
      ).toBe(true);
      expect(
        realtimeService.canAccessChannel("MANAGER", branchId, `branch:${branchId}:dispatch`)
      ).toBe(true);
      expect(
        realtimeService.canAccessChannel("MANAGER", branchId, `branch:${branchId}:admin`)
      ).toBe(true);
    });

    it("issueTicket rejects unauthorized channel request with 403 error", async () => {
      await expect(
        realtimeService.issueTicket({
          tenantId,
          branchId,
          userId,
          role: "KITCHEN_EMPLOYEE",
          channel: `branch:${branchId}:dispatch`, // Forbidden for kitchen employee
        })
      ).rejects.toThrow("Role KITCHEN_EMPLOYEE is not authorized for channel");
    });
  });
});
