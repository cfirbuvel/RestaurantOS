import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { colors, borderRadius, typography, spacing } from "../tokens/tokens";
import { getStatusConfig } from "../tokens/status";
import {
  Clock,
  Flame,
  CheckCircle,
  Truck,
  AlertTriangle,
  XCircle,
  UserCheck,
  BellRing,
  MapPin,
  Coffee,
  Moon,
  Slash,
  WifiOff,
  CheckCheck,
  Activity,
  Info,
  CornerDownLeft,
} from "lucide-react-native";

export interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

const ICON_MAP: Record<string, any> = {
  Clock,
  Flame,
  CheckCircle,
  Truck,
  AlertTriangle,
  XCircle,
  UserCheck,
  BellRing,
  MapPin,
  Coffee,
  Moon,
  Slash,
  WifiOff,
  CheckCheck,
  Activity,
  Info,
  CornerDownLeft,
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = "md",
  style,
}) => {
  const config = getStatusConfig(status);
  const isSmall = size === "sm";
  const displayLabel = label || config.labelHe;
  const IconComponent = ICON_MAP[config.iconName] || Info;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: config.backgroundColor,
        borderWidth: 1,
        borderColor: config.borderColor,
        borderRadius: borderRadius.sm,
        paddingHorizontal: isSmall ? 6 : 8,
        paddingVertical: isSmall ? 2 : 4,
        alignSelf: "flex-start",
        ...style,
      }}
      accessibilityRole="text"
      accessibilityLabel={`סטטוס: ${displayLabel}`}
    >
      <IconComponent size={isSmall ? 12 : 14} color={config.color} />
      <Text
        style={{
          color: config.color,
          fontSize: isSmall ? typography.caption.fontSize : typography.bodySmall.fontSize,
          fontWeight: "600",
          marginHorizontal: 4,
        }}
        maxFontSizeMultiplier={1.5}
      >
        {displayLabel}
      </Text>
    </View>
  );
};
