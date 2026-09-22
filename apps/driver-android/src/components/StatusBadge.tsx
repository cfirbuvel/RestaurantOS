import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../theme/theme";

type StatusType =
  | "OFF_SHIFT" | "ON_SHIFT" | "BREAK"
  | "AVAILABLE" | "ASSIGNED"
  | "NOT_STARTED" | "IN_TRANSIT" | "AT_CUSTOMER" | "RETURNING"
  | string;

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  OFF_SHIFT:    { bg: theme.colors.statusOff,       label: "מחוץ למשמרת" },
  ON_SHIFT:     { bg: theme.colors.statusOn,        label: "במשמרת" },
  BREAK:        { bg: theme.colors.statusBreak,     label: "הפסקה" },
  AVAILABLE:    { bg: theme.colors.statusAvailable, label: "זמין" },
  ASSIGNED:     { bg: theme.colors.statusAssigned,  label: "משויך" },
  NOT_STARTED:  { bg: theme.colors.statusOff,       label: "ממתין" },
  IN_TRANSIT:   { bg: theme.colors.primary,         label: "בדרך" },
  AT_CUSTOMER:  { bg: theme.colors.warning,         label: "אצל הלקוח" },
  RETURNING:    { bg: theme.colors.statusBreak,     label: "חוזר" },
};

interface Props {
  status: StatusType;
  customLabel?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<Props> = ({ status, customLabel, size = "md" }) => {
  const config = STATUS_CONFIG[status] ?? { bg: theme.colors.muted, label: status };
  const label = customLabel ?? config.label;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === "sm" && styles.sm]}>
      <Text style={[styles.text, size === "sm" && styles.textSm]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  sm: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    color: "#fff",
    fontSize: theme.font.sm,
    fontWeight: "700",
  },
  textSm: {
    fontSize: 11,
  },
});
