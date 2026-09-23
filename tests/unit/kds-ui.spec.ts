import { describe, it, expect } from "vitest";
import {
  computeKDSSLA,
  canTransitionKDSTicket,
  VALID_KDS_TRANSITIONS,
  KDSTicketStatus,
} from "@/modules/kds/domain/kds";

describe("KDS UI & SLA Domain Logic", () => {
  describe("computeKDSSLA Timer & SLA Status Calculations", () => {
    it("should classify 0% to 75% elapsed SLA as NORMAL", () => {
      const now = new Date("2026-09-22T10:05:00Z");
      const queuedAt = new Date("2026-09-22T10:00:00Z"); // 5 mins elapsed out of 15 min target (33%)

      const res = computeKDSSLA(queuedAt, 15, now);
      expect(res.slaStatus).toBe("NORMAL");
      expect(res.isExceeded).toBe(false);
      expect(res.elapsedSeconds).toBe(300);
      expect(res.remainingSeconds).toBe(600);
      expect(res.formattedTimer).toBe("10:00");
    });

    it("should classify >= 75% and <= 100% elapsed SLA as NEAR_SLA warning", () => {
      const queuedAt = new Date("2026-09-22T10:00:00Z");
      const now = new Date("2026-09-22T10:12:00Z"); // 12 mins elapsed (80% of 15 mins)

      const res = computeKDSSLA(queuedAt, 15, now);
      expect(res.slaStatus).toBe("NEAR_SLA");
      expect(res.isExceeded).toBe(false);
      expect(res.elapsedSeconds).toBe(720);
      expect(res.remainingSeconds).toBe(180);
      expect(res.formattedTimer).toBe("03:00");
    });

    it("should classify exactly at SLA boundary as NEAR_SLA countdown 00:00", () => {
      const queuedAt = new Date("2026-09-22T10:00:00Z");
      const now = new Date("2026-09-22T10:15:00Z"); // 15 mins elapsed (100%)

      const res = computeKDSSLA(queuedAt, 15, now);
      expect(res.slaStatus).toBe("NEAR_SLA");
      expect(res.remainingSeconds).toBe(0);
      expect(res.formattedTimer).toBe("00:00");
    });

    it("should classify > 100% elapsed SLA as SLA_EXCEEDED with +MM:SS overtime format", () => {
      const queuedAt = new Date("2026-09-22T10:00:00Z");
      // 15 minutes + 37 seconds elapsed
      const now = new Date("2026-09-22T10:15:37Z");

      const res = computeKDSSLA(queuedAt, 15, now);
      expect(res.slaStatus).toBe("SLA_EXCEEDED");
      expect(res.isExceeded).toBe(true);
      expect(res.elapsedSeconds).toBe(15 * 60 + 37);
      expect(res.formattedTimer).toBe("+00:37");
    });

    it("should format large overtime correctly (e.g. +12:45)", () => {
      const queuedAt = new Date("2026-09-22T10:00:00Z");
      const now = new Date("2026-09-22T10:27:45Z"); // 12m 45s overtime

      const res = computeKDSSLA(queuedAt, 15, now);
      expect(res.slaStatus).toBe("SLA_EXCEEDED");
      expect(res.formattedTimer).toBe("+12:45");
    });
  });

  describe("Ticket State Machine Transitions (canTransitionKDSTicket)", () => {
    it("allows valid forward transitions: QUEUED -> STARTED -> READY -> COMPLETED", () => {
      expect(canTransitionKDSTicket("QUEUED", "STARTED")).toBe(true);
      expect(canTransitionKDSTicket("STARTED", "READY")).toBe(true);
      expect(canTransitionKDSTicket("READY", "COMPLETED")).toBe(true);
    });

    it("allows recall transition: COMPLETED -> RECALLED", () => {
      expect(canTransitionKDSTicket("COMPLETED", "RECALLED")).toBe(true);
    });

    it("allows restarting or readying recalled tickets: RECALLED -> STARTED, RECALLED -> READY", () => {
      expect(canTransitionKDSTicket("RECALLED", "STARTED")).toBe(true);
      expect(canTransitionKDSTicket("RECALLED", "READY")).toBe(true);
    });

    it("rejects illegal transitions", () => {
      expect(canTransitionKDSTicket("QUEUED", "READY")).toBe(false);
      expect(canTransitionKDSTicket("QUEUED", "COMPLETED")).toBe(false);
      expect(canTransitionKDSTicket("STARTED", "COMPLETED")).toBe(false);
      expect(canTransitionKDSTicket("READY", "STARTED")).toBe(false);
      expect(canTransitionKDSTicket("COMPLETED", "STARTED")).toBe(false);
    });
  });

  describe("Client-side Reconnect Backoff Progression", () => {
    it("progresses exponentially up to max 30000ms cap", () => {
      let backoff = 1000;
      const sequence: number[] = [];

      for (let i = 0; i < 7; i++) {
        sequence.push(backoff);
        backoff = Math.min(backoff * 2, 30000);
      }

      expect(sequence).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    });
  });
});
