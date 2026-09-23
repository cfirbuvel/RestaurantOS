import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { colors, borderRadius, spacing, typography, touchTargets } from "../tokens/tokens";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "outline"
  | "warning"
  | "muted";

export type ButtonSize = "sm" | "md" | "lg";

export interface ActionButtonProps {
  children?: React.ReactNode;
  label?: string;
  onPress?: () => void | Promise<void>;
  onClick?: () => void | Promise<void>; // Backward-compat alias for onPress
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  label,
  onPress,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
  accessibilityLabel,
}) => {
  const handlePress = onPress || onClick || (() => {});

  let bgColor = colors.button.primaryBg;
  let textColor = colors.button.primaryText;
  let borderColor = "transparent";

  switch (variant) {
    case "primary":
      bgColor = colors.button.primaryBg;
      textColor = colors.button.primaryText;
      break;
    case "secondary":
      bgColor = colors.button.secondaryBg;
      textColor = colors.button.secondaryText;
      borderColor = colors.button.secondaryBorder;
      break;
    case "danger":
      bgColor = colors.button.dangerBg;
      textColor = colors.button.dangerText;
      break;
    case "success":
      bgColor = colors.button.successBg;
      textColor = colors.button.successText;
      break;
    case "warning":
      bgColor = colors.status.warning;
      textColor = "#000000";
      break;
    case "muted":
      bgColor = colors.button.disabledBg;
      textColor = colors.button.disabledText;
      break;
    case "outline":
      bgColor = "transparent";
      textColor = colors.brand;
      borderColor = colors.brand;
      break;
  }

  const minHeight =
    size === "sm" ? 40 : size === "lg" ? 56 : touchTargets.min;

  const contentText = label || (typeof children === "string" ? children : "");

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof contentText === "string" ? contentText : undefined)}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        width: fullWidth ? "100%" : "auto",
        backgroundColor: disabled ? colors.button.disabledBg : bgColor,
        borderWidth: 1,
        borderColor,
        borderRadius: borderRadius.md,
        paddingHorizontal: size === "sm" ? spacing.md : spacing.lg,
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={textColor}
          style={{ marginEnd: spacing.sm }}
        />
      ) : (
        icon && <View style={{ marginEnd: spacing.sm }}>{icon}</View>
      )}

      {contentText ? (
        <Text
          style={{
            color: disabled ? colors.textMuted : textColor,
            fontSize:
              size === "sm"
                ? typography.bodySmall.fontSize
                : typography.bodyMedium.fontSize,
            fontWeight: "700",
            ...textStyle,
          }}
          maxFontSizeMultiplier={1.5}
        >
          {contentText}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};
