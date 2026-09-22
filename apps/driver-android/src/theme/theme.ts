// ─── Driver App Theme ─────────────────────────────────────────────────────────
// Dark, high-contrast design optimised for outdoor use and glanceability.
// Large tap targets (min 48dp), bold status colours.

export const theme = {
  colors: {
    // Backgrounds
    bg: "#0f172a",           // Deep navy
    bgCard: "#1e293b",       // Card surface
    bgElevated: "#273549",   // Elevated elements

    // Accents
    primary: "#3b82f6",      // Blue — primary actions
    primaryDark: "#2563eb",
    success: "#22c55e",      // Green — available / complete
    successDark: "#16a34a",
    warning: "#f59e0b",      // Amber — in-progress / break
    warningDark: "#d97706",
    danger: "#ef4444",       // Red — clock-out / release
    dangerDark: "#dc2626",
    muted: "#475569",        // Disabled

    // Text
    text: "#f8fafc",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",

    // Status badges
    statusOff: "#374151",
    statusOn: "#065f46",
    statusBreak: "#78350f",
    statusAvailable: "#064e3b",
    statusAssigned: "#1e3a5f",

    // Borders
    border: "#334155",
    borderLight: "#1e293b",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 50,
  },

  font: {
    sm: 13,
    md: 16,
    lg: 20,
    xl: 26,
    xxl: 32,
  },

  // 48dp minimum touch target (WCAG / Material Design)
  minTouchTarget: 48,
};

export type Theme = typeof theme;
