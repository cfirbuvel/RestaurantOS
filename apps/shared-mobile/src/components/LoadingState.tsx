import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, typography } from "../tokens/tokens";

export interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  size?: "small" | "large";
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "טוען נתונים...",
  fullScreen = true,
  size = "large",
  style,
}) => {
  return (
    <View
      style={[
        fullScreen ? styles.fullScreen : styles.inline,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size={size} color={colors.brand} />
      {message ? (
        <Text style={styles.text} maxFontSizeMultiplier={1.5}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  inline: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  text: {
    color: colors.textSecondary,
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "500",
    textAlign: "center",
  },
});
