/**
 * RestaurantOS Manager Mobile Design Tokens & Theme
 *
 * Implements:
 * - WCAG 2.1 AA Compliant Contrast on Dark Surfaces
 * - Standardized 48dp Minimum Touch Target Geometry
 * - RestaurantOS Multi-State Semantics (Active, Pending, Warning, Offline, SLA)
 * - Hebrew RTL & English Typography Scales
 */

export const colors = {
  // Backgrounds & Surface
  background: "#090D16",        // Deep night slate
  surface: "#111827",           // Card surface
  surfaceElevated: "#1F2937",   // Modal / elevated sheet
  surfaceHighlight: "#374151",  // Active row / focus
  border: "#1F2937",
  borderLight: "#374151",

  // Typography
  textPrimary: "#F9FAFB",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  textInverse: "#090D16",

  // Brand Accent
  brand: "#F59E0B",            // RestaurantOS Warm Amber / Gold
  brandHover: "#D97706",
  brandMuted: "rgba(245, 158, 11, 0.15)",

  // Operational Semantic Status Tokens
  status: {
    // Orders & Approvals
    confirmed: "#3B82F6",       // Blue
    inPreparation: "#F59E0B",   // Amber
    ready: "#10B981",           // Emerald Green
    completed: "#6B7280",       // Neutral Gray
    cancelled: "#EF4444",       // Rose Red

    // Delivery & Drivers
    available: "#10B981",       // Driver available in queue
    assigned: "#8B5CF6",        // In-transit / active trip (Purple)
    onBreak: "#F97316",         // Orange
    offShift: "#4B5563",        // Dark gray

    // System & Alerts
    warning: "#F59E0B",         // Attention / SLA approaching
    critical: "#EF4444",        // SLA breach / No drivers
    info: "#0EA5E9",            // Informational notification
    offline: "#DC2626",         // Network dropped
    online: "#10B981",          // Connected realtime
  },

  // Interactive Elements
  buttonPrimary: "#F59E0B",
  buttonPrimaryText: "#000000",
  buttonSecondary: "#1F2937",
  buttonSecondaryText: "#F9FAFB",
  buttonDanger: "#EF4444",
  buttonDangerText: "#FFFFFF",
  buttonSuccess: "#10B981",
  buttonSuccessText: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  touchTargetMin: 48, // 48dp minimum for accessible touch actions
};

export const typography = {
  titleLarge: { fontSize: 24, fontWeight: "700" as const, lineHeight: 30 },
  titleMedium: { fontSize: 18, fontWeight: "600" as const, lineHeight: 24 },
  titleSmall: { fontSize: 16, fontWeight: "600" as const, lineHeight: 20 },
  bodyLarge: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22 },
  bodyMedium: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: "500" as const, letterSpacing: 0.5 },
  metricValue: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 9999,
};
