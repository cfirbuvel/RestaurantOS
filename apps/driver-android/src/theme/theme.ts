/**
 * Driver App Theme
 * 
 * [PHASE 18 MIGRATION SHIM]
 * Connected to @restaurantos/shared-mobile canonical design system.
 * See docs/MOBILE_DESIGN_SYSTEM.md for migration tracking.
 */

import {
  colors as sharedColors,
  spacing as sharedSpacing,
  borderRadius as sharedRadius,
  touchTargets,
} from "@restaurantos/shared-mobile";

export const theme = {
  colors: {
    // Backgrounds & Surface
    bg: sharedColors.background,
    bgCard: sharedColors.surface,
    bgElevated: sharedColors.surfaceElevated,
    bgCardHover: sharedColors.surfaceHighlight,

    // Interactive & Brand Accents
    primary: sharedColors.brandSecondary,
    primaryDark: sharedColors.brandSecondaryDark,
    success: sharedColors.status.ready,
    successDark: "#16a34a",
    warning: sharedColors.brand,
    warningDark: sharedColors.brandHover,
    danger: sharedColors.button.dangerBg,
    dangerDark: "#dc2626",
    muted: sharedColors.status.unavailable,

    // Typography
    text: sharedColors.textPrimary,
    textSecondary: sharedColors.textSecondary,
    textMuted: sharedColors.textMuted,

    // Status badges
    statusOff: sharedColors.status.offShift,
    statusOn: sharedColors.status.onShift,
    statusBreak: sharedColors.status.onBreak,
    statusAvailable: sharedColors.status.available,
    statusAssigned: sharedColors.status.assigned,

    // Borders
    border: sharedColors.border,
    borderLight: sharedColors.borderLight,
  },

  spacing: {
    xs: sharedSpacing.xs,
    sm: sharedSpacing.sm,
    md: 16,
    lg: sharedSpacing.xl,
    xl: sharedSpacing.xxl,
    xxl: sharedSpacing.xxxl,
  },

  radius: {
    sm: sharedRadius.sm,
    md: sharedRadius.md,
    lg: sharedRadius.lg,
    pill: sharedRadius.pill,
  },

  font: {
    xs: 11,
    sm: 13,
    md: 16,
    lg: 20,
    xl: 26,
    xxl: 32,
  },

  minTouchTarget: touchTargets.min,
};

export type Theme = typeof theme;
