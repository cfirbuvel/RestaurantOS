import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { colors, borderRadius, typography, spacing } from "../theme/theme";
import { CheckCircle, Clock, AlertTriangle, XCircle, Truck, User, Flame } from "lucide-react-native";

export type StatusType =
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
  | "RETURNING"
  | "SLA_NORMAL"
  | "SLA_BREACH"
  | "CRITICAL"
  | "WARNING";

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = "md", style }) => {
  const norm = (status || "").toUpperCase();

  let bgColor = "rgba(107, 114, 128, 0.15)";
  let textColor = colors.textSecondary;
  let borderColor = colors.border;
  let Icon = Clock;
  let defaultLabel = status;

  switch (norm) {
    case "CONFIRMED":
    case "ACCEPTED":
      bgColor = "rgba(59, 130, 246, 0.15)";
      textColor = colors.status.confirmed;
      borderColor = "rgba(59, 130, 246, 0.3)";
      Icon = Clock;
      defaultLabel = "מאושר";
      break;

    case "IN_PREPARATION":
    case "PREPARING":
      bgColor = "rgba(245, 158, 11, 0.15)";
      textColor = colors.status.inPreparation;
      borderColor = "rgba(245, 158, 11, 0.3)";
      Icon = Flame;
      defaultLabel = "בהכנה";
      break;

    case "READY":
    case "AVAILABLE":
    case "SLA_NORMAL":
      bgColor = "rgba(16, 185, 129, 0.15)";
      textColor = colors.status.ready;
      borderColor = "rgba(16, 185, 129, 0.3)";
      Icon = CheckCircle;
      defaultLabel = norm === "AVAILABLE" ? "זמין בתור" : "מוכן";
      break;

    case "ASSIGNED":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "PICKED_UP":
      bgColor = "rgba(139, 92, 246, 0.15)";
      textColor = colors.status.assigned;
      borderColor = "rgba(139, 92, 246, 0.3)";
      Icon = Truck;
      defaultLabel = "בדרך";
      break;

    case "BREAK":
      bgColor = "rgba(249, 115, 22, 0.15)";
      textColor = colors.status.onBreak;
      borderColor = "rgba(249, 115, 22, 0.3)";
      Icon = Clock;
      defaultLabel = "בהפסקה";
      break;

    case "COMPLETED":
    case "DELIVERED":
    case "OFF_SHIFT":
      bgColor = "rgba(107, 114, 128, 0.15)";
      textColor = colors.textMuted;
      borderColor = "rgba(107, 114, 128, 0.3)";
      Icon = CheckCircle;
      defaultLabel = norm === "OFF_SHIFT" ? "לא במשמרת" : "הושלם";
      break;

    case "CANCELLED":
    case "SLA_BREACH":
    case "CRITICAL":
      bgColor = "rgba(239, 68, 68, 0.15)";
      textColor = colors.status.critical;
      borderColor = "rgba(239, 68, 68, 0.3)";
      Icon = norm === "SLA_BREACH" || norm === "CRITICAL" ? AlertTriangle : XCircle;
      defaultLabel = norm === "CANCELLED" ? "בוטל" : "חריגת SLA";
      break;
  }

  const isSmall = size === "sm";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bgColor,
        borderWidth: 1,
        borderColor,
        borderRadius: borderRadius.sm,
        paddingHorizontal: isSmall ? 6 : 8,
        paddingVertical: isSmall ? 2 : 4,
        alignSelf: "flex-start",
        ...style,
      }}
    >
      <Icon size={isSmall ? 12 : 14} color={textColor} />
      <Text
        style={{
          color: textColor,
          fontSize: isSmall ? typography.caption.fontSize : typography.bodySmall.fontSize,
          fontWeight: "600",
          marginHorizontal: 4,
        }}
      >
        {label || defaultLabel}
      </Text>
    </View>
  );
};
