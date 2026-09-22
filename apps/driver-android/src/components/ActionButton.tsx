import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { theme } from "../theme/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "success" | "warning" | "danger" | "muted";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const VARIANT_COLORS: Record<string, string> = {
  primary: theme.colors.primary,
  success: theme.colors.success,
  warning: theme.colors.warning,
  danger: theme.colors.danger,
  muted: theme.colors.muted,
};

export const ActionButton: React.FC<Props> = ({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  fullWidth = true,
}) => {
  const bg = disabled ? theme.colors.muted : VARIANT_COLORS[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, width: fullWidth ? "100%" : undefined },
        style,
      ]}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    minHeight: theme.minTouchTarget,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#fff",
    fontSize: theme.font.md,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
