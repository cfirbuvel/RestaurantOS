import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  colors,
  spacing,
  touchTargets,
  borderRadius,
  typography,
  motion,
} from "@/../apps/shared-mobile/src/tokens/tokens";
import {
  STATUS_SEMANTICS,
  getStatusConfig,
} from "@/../apps/shared-mobile/src/tokens/status";
import {
  formatPhoneNumber,
  formatOrderId,
  formatCurrency,
  formatAddress,
  formatTimestamp,
  formatDuration,
  getRowDirection,
  getTextAlign,
  bidiIsolate,
  LRM,
  LRE,
  PDF,
  FSI,
  PDI,
} from "@/../apps/shared-mobile/src/core/rtl-utils";
import {
  a11yProps,
  touchTargetStyle,
  MAX_FONT_SCALE,
  a11yTextProps,
} from "@/../apps/shared-mobile/src/core/accessibility";
import { offlineManager } from "@/../apps/shared-mobile/src/core/offline-manager";

describe("Phase 18: Shared Mobile Design System & UX Hardening", () => {
  describe("1. Canonical Design Tokens", () => {
    it("should enforce WCAG 2.1 AA touch target standards (>= 48dp)", () => {
      expect(touchTargets.min).toBeGreaterThanOrEqual(48);
      expect(touchTargets.comfortable).toBe(56);
      expect(touchTargets.large).toBe(64);
    });

    it("should define complete operational dark color tokens", () => {
      expect(colors.background).toBe("#090D16");
      expect(colors.surface).toBe("#111827");
      expect(colors.brand).toBe("#F59E0B");
      expect(colors.textPrimary).toBe("#F9FAFB");
      expect(colors.border).toBe("#1F2937");
    });

    it("should provide consistent spacing and typography scales", () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.lg).toBe(16);
      expect(spacing.xl).toBe(24);

      expect(typography.titleLarge.fontSize).toBe(24);
      expect(typography.titleMedium.fontSize).toBe(18);
      expect(typography.bodyMedium.fontSize).toBe(14);
      expect(typography.caption.fontSize).toBe(11);
    });

    it("should enforce rapid operational motion durations (Speed > Animation)", () => {
      expect(motion.durationFast).toBeLessThanOrEqual(150);
      expect(motion.durationNormal).toBeLessThanOrEqual(250);
      expect(motion.durationSlow).toBeLessThanOrEqual(350);
    });
  });

  describe("2. Tri-Factor Status Semantics (Never Color Alone)", () => {
    const requiredStatuses = [
      "SUCCESS",
      "WARNING",
      "ERROR",
      "PENDING",
      "ACTIVE",
      "UNAVAILABLE",
      "OFFLINE",
    ];

    it.each(requiredStatuses)(
      "status %s must have tri-factor properties (color, icon, Hebrew label)",
      (statusKey) => {
        const config = STATUS_SEMANTICS[statusKey];
        expect(config).toBeDefined();
        expect(config.color).toBeTruthy();
        expect(config.backgroundColor).toBeTruthy();
        expect(config.borderColor).toBeTruthy();
        expect(config.iconName).toBeTruthy();
        expect(config.labelHe).toBeTruthy();
        expect(config.labelEn).toBeTruthy();
      }
    );

    it("should provide fallback for unknown operational statuses", () => {
      const fallback = getStatusConfig("CUSTOM_UNKNOWN_STATE");
      expect(fallback).toBeDefined();
      expect(fallback.iconName).toBe("Info");
      expect(fallback.labelHe).toBe("CUSTOM_UNKNOWN_STATE");
    });

    it("should support operational lifecycle and driver states", () => {
      expect(getStatusConfig("CONFIRMED").labelHe).toBe("מאושר");
      expect(getStatusConfig("IN_PREPARATION").labelHe).toBe("בהכנה");
      expect(getStatusConfig("READY").labelHe).toBe("מוכן");
      expect(getStatusConfig("AVAILABLE").labelHe).toBe("זמין בתור");
      expect(getStatusConfig("ASSIGNED").labelHe).toBe("משויך");
      expect(getStatusConfig("SLA_BREACH").labelHe).toBe("חריגת SLA");
    });
  });

  describe("3. RTL & Bidirectional Formatting Utilities", () => {
    it("should isolate phone numbers in LTR embedding to prevent RTL glyph flipping", () => {
      const formatted = formatPhoneNumber("054-123-4567");
      expect(formatted.startsWith(LRE)).toBe(true);
      expect(formatted.endsWith(PDF)).toBe(true);
      expect(formatted).toContain("054-123-4567");
    });

    it("should isolate order IDs with LRM markers to prevent inverted hash numbers", () => {
      const formatted = formatOrderId("1042");
      expect(formatted).toBe(`${LRM}#1042${LRM}`);

      const formattedWithHash = formatOrderId("#8841");
      expect(formattedWithHash).toBe(`${LRM}#8841${LRM}`);
    });

    it("should format currency with Shekel symbol (₪)", () => {
      const formatted = formatCurrency(124.5);
      expect(formatted).toContain("₪");
      expect(formatted).toContain("124.50");
    });

    it("should format addresses with street, number, and city in correct Hebrew ordering", () => {
      const addr = formatAddress("דיזנגוף", 100, "תל אביב");
      expect(addr).toBe("דיזנגוף 100, תל אביב");

      const addrNoNum = formatAddress("רוטשילד", undefined, "תל אביב");
      expect(addrNoNum).toBe("רוטשילד, תל אביב");
    });

    it("should format timestamps cleanly", () => {
      const date = new Date("2026-09-23T14:30:00Z");
      const timeStr = formatTimestamp(date);
      expect(timeStr).toBeTruthy();
    });

    it("should format operational durations in minutes", () => {
      expect(formatDuration(15, true)).toBe("15 דק׳");
      expect(formatDuration(15, false)).toBe("15 min");
    });

    it("should provide RTL direction helpers", () => {
      expect(getRowDirection(true)).toBe("row-reverse");
      expect(getRowDirection(false)).toBe("row");
      expect(getTextAlign(true)).toBe("right");
      expect(getTextAlign(false)).toBe("left");
    });

    it("should wrap mixed bidi strings with FSI and PDI", () => {
      const isolated = bidiIsolate("Order #42 at Wolt");
      expect(isolated).toBe(`${FSI}Order #42 at Wolt${PDI}`);
    });
  });

  describe("4. Accessibility & Touch Target Enforcement", () => {
    it("should generate proper accessibility props", () => {
      const props = a11yProps({
        label: "אשר משלוח",
        role: "button",
        hint: "לחיצה תשייך את המשלוח לנהג",
      });

      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe("אשר משלוח");
      expect(props.accessibilityRole).toBe("button");
      expect(props.accessibilityHint).toBe("לחיצה תשייך את המשלוח לנהג");
    });

    it("should generate touchTargetStyle with minimum 48dp geometry", () => {
      const style = touchTargetStyle();
      expect(style.minHeight).toBe(48);
      expect(style.minWidth).toBe(48);
      expect(style.justifyContent).toBe("center");
      expect(style.alignItems).toBe("center");
    });

    it("should enforce safe font scaling clamp (MAX_FONT_SCALE = 1.5)", () => {
      expect(MAX_FONT_SCALE).toBe(1.5);
      expect(a11yTextProps.maxFontSizeMultiplier).toBe(1.5);
      expect(a11yTextProps.allowFontScaling).toBe(true);
    });
  });

  describe("5. Unified Offline Manager State Machine", () => {
    beforeEach(() => {
      offlineManager.setStatus("ONLINE");
    });

    it("should start in ONLINE state", () => {
      expect(offlineManager.getStatus()).toBe("ONLINE");
      expect(offlineManager.isOnline).toBe(true);
    });

    it("should transition states and notify subscribers", () => {
      const listener = vi.fn();
      const unsub = offlineManager.subscribe(listener);

      expect(listener).toHaveBeenCalledWith("ONLINE");

      offlineManager.setStatus("RECONNECTING");
      expect(listener).toHaveBeenCalledWith("RECONNECTING");
      expect(offlineManager.getStatus()).toBe("RECONNECTING");

      offlineManager.setStatus("OFFLINE");
      expect(listener).toHaveBeenCalledWith("OFFLINE");
      expect(offlineManager.isOnline).toBe(false);

      unsub();
      offlineManager.setStatus("ONLINE");
      expect(listener).toHaveBeenCalledTimes(3); // unsub stopped further calls
    });
  });
});
