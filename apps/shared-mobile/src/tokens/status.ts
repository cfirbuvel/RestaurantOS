/**
 * RestaurantOS Tri-Factor Status Semantics
 * 
 * Invariant: Status must NEVER rely on color alone.
 * Every semantic state provides:
 * 1. Background tint & Border color
 * 2. High-contrast foreground text color
 * 3. Dedicated semantic icon name (compatible with lucide-react-native)
 * 4. Human-readable canonical Hebrew label
 */

import { colors } from "./tokens";

export type SemanticStatus =
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "PENDING"
  | "ACTIVE"
  | "UNAVAILABLE"
  | "OFFLINE"
  // Operational mappings
  | "CONFIRMED"
  | "ACCEPTED"
  | "IN_PREPARATION"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "AVAILABLE"
  | "ASSIGNED"
  | "ON_SHIFT"
  | "OFF_SHIFT"
  | "BREAK"
  | "IN_TRANSIT"
  | "AT_CUSTOMER"
  | "RETURNING"
  | "SLA_BREACH"
  | "CRITICAL";

export interface StatusConfig {
  color: string;
  backgroundColor: string;
  borderColor: string;
  iconName: string;
  labelHe: string;
  labelEn: string;
}

export const STATUS_SEMANTICS: Record<string, StatusConfig> = {
  // Canonical Core Statuses (Prompt 18 spec)
  SUCCESS: {
    color: colors.status.success,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    iconName: "CheckCircle2",
    labelHe: "הצלחה",
    labelEn: "Success",
  },
  WARNING: {
    color: colors.status.warning,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    iconName: "AlertTriangle",
    labelHe: "לתשומת לב",
    labelEn: "Warning",
  },
  ERROR: {
    color: colors.status.error,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    iconName: "AlertOctagon",
    labelHe: "שגיאה",
    labelEn: "Error",
  },
  PENDING: {
    color: colors.status.pending,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    iconName: "Clock",
    labelHe: "ממתין",
    labelEn: "Pending",
  },
  ACTIVE: {
    color: colors.status.active,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.35)",
    iconName: "Activity",
    labelHe: "פעיל",
    labelEn: "Active",
  },
  UNAVAILABLE: {
    color: colors.status.unavailable,
    backgroundColor: "rgba(107, 114, 128, 0.15)",
    borderColor: "rgba(107, 114, 128, 0.3)",
    iconName: "Slash",
    labelHe: "לא זמין",
    labelEn: "Unavailable",
  },
  OFFLINE: {
    color: colors.status.offline,
    backgroundColor: "rgba(220, 38, 38, 0.18)",
    borderColor: "rgba(220, 38, 38, 0.4)",
    iconName: "WifiOff",
    labelHe: "לא מחובר",
    labelEn: "Offline",
  },

  // Operational Lifecycle States
  CONFIRMED: {
    color: colors.status.confirmed,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.35)",
    iconName: "CheckCircle",
    labelHe: "מאושר",
    labelEn: "Confirmed",
  },
  ACCEPTED: {
    color: colors.status.confirmed,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.35)",
    iconName: "CheckCircle",
    labelHe: "התקבל",
    labelEn: "Accepted",
  },
  IN_PREPARATION: {
    color: colors.status.inPreparation,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    iconName: "Flame",
    labelHe: "בהכנה",
    labelEn: "In Preparation",
  },
  READY: {
    color: colors.status.ready,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    iconName: "BellRing",
    labelHe: "מוכן",
    labelEn: "Ready",
  },
  COMPLETED: {
    color: colors.status.completed,
    backgroundColor: "rgba(107, 114, 128, 0.15)",
    borderColor: "rgba(107, 114, 128, 0.3)",
    iconName: "CheckCheck",
    labelHe: "הושלם",
    labelEn: "Completed",
  },
  CANCELLED: {
    color: colors.status.cancelled,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    iconName: "XCircle",
    labelHe: "בוטל",
    labelEn: "Cancelled",
  },

  // Driver & Fleet States
  AVAILABLE: {
    color: colors.status.available,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    iconName: "UserCheck",
    labelHe: "זמין בתור",
    labelEn: "Available",
  },
  ASSIGNED: {
    color: colors.status.assigned,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.35)",
    iconName: "Truck",
    labelHe: "משויך",
    labelEn: "Assigned",
  },
  ON_SHIFT: {
    color: colors.status.onShift,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    iconName: "Clock",
    labelHe: "במשמרת",
    labelEn: "On Shift",
  },
  OFF_SHIFT: {
    color: colors.status.offShift,
    backgroundColor: "rgba(75, 85, 99, 0.2)",
    borderColor: "rgba(75, 85, 99, 0.4)",
    iconName: "Moon",
    labelHe: "לא במשמרת",
    labelEn: "Off Shift",
  },
  BREAK: {
    color: colors.status.onBreak,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.35)",
    iconName: "Coffee",
    labelHe: "בהפסקה",
    labelEn: "On Break",
  },
  IN_TRANSIT: {
    color: colors.status.assigned,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.35)",
    iconName: "Navigation",
    labelHe: "בדרך",
    labelEn: "In Transit",
  },
  AT_CUSTOMER: {
    color: colors.status.warning,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    iconName: "MapPin",
    labelHe: "אצל הלקוח",
    labelEn: "At Customer",
  },
  RETURNING: {
    color: colors.status.completed,
    backgroundColor: "rgba(107, 114, 128, 0.15)",
    borderColor: "rgba(107, 114, 128, 0.3)",
    iconName: "CornerDownLeft",
    labelHe: "חוזר לסניף",
    labelEn: "Returning",
  },
  SLA_BREACH: {
    color: colors.status.critical,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    iconName: "AlertTriangle",
    labelHe: "חריגת SLA",
    labelEn: "SLA Breach",
  },
  CRITICAL: {
    color: colors.status.critical,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    iconName: "AlertOctagon",
    labelHe: "קריטי",
    labelEn: "Critical",
  },
};

export function getStatusConfig(status: string): StatusConfig {
  const norm = (status || "").toUpperCase();
  return (
    STATUS_SEMANTICS[norm] ?? {
      color: colors.textSecondary,
      backgroundColor: "rgba(107, 114, 128, 0.15)",
      borderColor: colors.border,
      iconName: "Info",
      labelHe: status || "לא ידוע",
      labelEn: status || "Unknown",
    }
  );
}
