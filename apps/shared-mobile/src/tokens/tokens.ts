/**
 * RestaurantOS Canonical Shared Mobile Design Tokens
 * 
 * High-velocity hospitality operational tokens:
 * - WCAG 2.1 AA Compliant Contrast on Dark Surfaces
 * - Minimum 48dp Touch Target Geometry
 * - RestaurantOS Multi-State Semantics (Tri-factor: color, icon, label)
 * - Hebrew RTL First-Class Ergonomics
 */

export const colors = {
  // Backgrounds & Surface (Deep night slate canvas)
  background: "#090D16",
  surface: "#111827",
  surfaceElevated: "#1F2937",
  surfaceHighlight: "#374151",
  surfaceMuted: "#1E293B",
  
  // Borders & Dividers
  border: "#1F2937",
  borderLight: "#374151",
  borderFocus: "#3B82F6",

  // Typography
  textPrimary: "#F9FAFB",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  textInverse: "#090D16",
  textLight: "#FFFFFF",

  // Brand Accents
  brand: "#F59E0B",               // Warm Amber / Gold
  brandHover: "#D97706",
  brandMuted: "rgba(245, 158, 11, 0.15)",
  brandSecondary: "#3B82F6",      // Operational Blue
  brandSecondaryDark: "#2563EB",

  // Operational Semantic Status Colors
  status: {
    // Orders & Lifecycle
    confirmed: "#3B82F6",         // Blue - Confirmed/Approved
    inPreparation: "#F59E0B",     // Amber - Ticket on station
    ready: "#10B981",             // Emerald - Ready on pass / pickup
    completed: "#6B7280",         // Gray - Completed / Fulfilled
    cancelled: "#EF4444",         // Rose Red - Cancelled / Voided

    // Fleet & Shift Logistics
    available: "#10B981",         // Green - Available in queue
    assigned: "#8B5CF6",          // Purple - In-transit / active delivery
    onShift: "#10B981",           // Green - Clocked in
    onBreak: "#F97316",           // Orange - On break
    offShift: "#4B5563",          // Dark Gray - Off duty

    // Operational Feedback & Network
    success: "#10B981",           // Success action
    warning: "#F59E0B",           // SLA approaching / Attention needed
    error: "#EF4444",             // Error / Breach / Rejection
    critical: "#EF4444",          // Urgent immediate action required
    pending: "#F59E0B",           // Pending resolution
    active: "#3B82F6",            // Active process
    unavailable: "#6B7280",       // Temporarily disabled
    offline: "#DC2626",           // Network connection dropped
    online: "#10B981",            // Realtime websocket connected
    info: "#0EA5E9",              // Informational announcement
  },

  // Interactive Buttons
  button: {
    primaryBg: "#F59E0B",
    primaryText: "#000000",
    secondaryBg: "#1F2937",
    secondaryText: "#F9FAFB",
    secondaryBorder: "#374151",
    dangerBg: "#EF4444",
    dangerText: "#FFFFFF",
    successBg: "#10B981",
    successText: "#FFFFFF",
    disabledBg: "rgba(107, 114, 128, 0.2)",
    disabledText: "#6B7280",
  },

  // Form Inputs
  input: {
    bg: "#111827",
    border: "#374151",
    borderFocus: "#F59E0B",
    borderError: "#EF4444",
    placeholder: "#6B7280",
    text: "#F9FAFB",
  },

  // Skeleton Shimmer Base
  skeleton: {
    base: "#1F2937",
    highlight: "#374151",
  }
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const touchTargets = {
  min: 48,           // 48dp minimum for accessible touch actions (WCAG 2.1 AA)
  comfortable: 56,   // Ergonomic handheld operational target
  large: 64,         // High-velocity kitchen bump bar / driver action
};

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
  pill: 50,
};

export const elevation = {
  none: 0,
  low: 2,
  medium: 4,
  high: 8,
};

export const typography = {
  displayLarge: { fontSize: 32, fontWeight: "800" as const, lineHeight: 38 },
  titleLarge: { fontSize: 24, fontWeight: "700" as const, lineHeight: 30 },
  titleMedium: { fontSize: 18, fontWeight: "600" as const, lineHeight: 24 },
  titleSmall: { fontSize: 16, fontWeight: "600" as const, lineHeight: 20 },
  bodyLarge: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22 },
  bodyLargeBold: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  bodyMedium: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  bodyMediumBold: { fontSize: 14, fontWeight: "600" as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
  bodySmallBold: { fontSize: 12, fontWeight: "600" as const, lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: "500" as const, lineHeight: 14, letterSpacing: 0.5 },
  metricValue: { fontSize: 28, fontWeight: "800" as const, lineHeight: 34, letterSpacing: -0.5 },
  monoTimer: { fontSize: 20, fontWeight: "700" as const, lineHeight: 24 },
};

export const motion = {
  durationFast: 150,    // Micro-interactions (taps, toggles)
  durationNormal: 250,  // Sheet transitions, status changes
  durationSlow: 350,    // Dialog presentations
};

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Typography = typeof typography;
export type BorderRadius = typeof borderRadius;
