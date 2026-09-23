import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, typography } from "../tokens/tokens";
import { ActionButton } from "./ActionButton";
import { Inbox } from "lucide-react-native";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]} accessibilityRole="text">
      <View style={styles.iconContainer}>
        {icon || <Inbox size={36} color={colors.textMuted} />}
      </View>
      <Text style={styles.title} maxFontSizeMultiplier={1.5}>{title}</Text>
      {description ? (
        <Text style={styles.description} maxFontSizeMultiplier={1.5}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <ActionButton
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
            size="sm"
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSmall.fontSize,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.bodyMedium.fontSize,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  action: {
    marginTop: spacing.lg,
  },
});
