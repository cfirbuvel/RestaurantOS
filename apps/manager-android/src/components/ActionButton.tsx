import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle, View } from "react-native";
import { colors, borderRadius, spacing, typography } from "../theme/theme";

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = false,
}) => {
  let bgColor = colors.buttonPrimary;
  let textColor = colors.buttonPrimaryText;
  let borderColor = "transparent";

  switch (variant) {
    case "primary":
      bgColor = colors.buttonPrimary;
      textColor = colors.buttonPrimaryText;
      break;
    case "secondary":
      bgColor = colors.buttonSecondary;
      textColor = colors.buttonSecondaryText;
      borderColor = colors.borderLight;
      break;
    case "danger":
      bgColor = colors.buttonDanger;
      textColor = colors.buttonDangerText;
      break;
    case "success":
      bgColor = colors.buttonSuccess;
      textColor = colors.buttonSuccessText;
      break;
    case "outline":
      bgColor = "transparent";
      textColor = colors.brand;
      borderColor = colors.brand;
      break;
  }

  const minHeight = size === "sm" ? 38 : size === "lg" ? 54 : spacing.touchTargetMin;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onClick}
      disabled={disabled || loading}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        width: fullWidth ? "100%" : "auto",
        backgroundColor: disabled ? "rgba(107, 114, 128, 0.2)" : bgColor,
        borderWidth: 1,
        borderColor,
        borderRadius: borderRadius.md,
        paddingHorizontal: size === "sm" ? spacing.md : spacing.lg,
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} style={{ marginEnd: spacing.sm }} />
      ) : (
        icon && <View style={{ marginEnd: spacing.sm }}>{icon}</View>
      )}
      {typeof children === "string" ? (
        <Text
          style={{
            color: disabled ? colors.textMuted : textColor,
            fontSize: size === "sm" ? typography.bodySmall.fontSize : typography.bodyMedium.fontSize,
            fontWeight: "600",
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};
