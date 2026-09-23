import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, typography } from "../tokens/tokens";
import { ActionButton } from "./ActionButton";
import { AlertCircle, RefreshCw } from "lucide-react-native";

export interface ErrorStateProps {
  title?: string;               // What happened (e.g. "לא ניתן להקצות את המשלוח.")
  description?: string;         // Why / what the user can do (e.g. "המשלוח כבר הוקצה לנהג אחר.")
  actionLabel?: string;         // Button text (default "רענן")
  onAction?: () => void;        // Action callback
  fullScreen?: boolean;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "אירעה שגיאה בביצוע הפעולה",
  description = "אנא בדוק את החיבור לרשת ונסה שוב.",
  actionLabel = "רענן",
  onAction,
  fullScreen = true,
  style,
}) => {
  return (
    <View
      style={[
        fullScreen ? styles.fullScreen : styles.inline,
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.iconContainer}>
        <AlertCircle size={36} color={colors.status.error} />
      </View>

      <Text style={styles.title} maxFontSizeMultiplier={1.5}>
        {title}
      </Text>

      {description ? (
        <Text style={styles.description} maxFontSizeMultiplier={1.5}>
          {description}
        </Text>
      ) : null}

      {onAction ? (
        <View style={styles.actionContainer}>
          <ActionButton
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
            size="md"
            icon={<RefreshCw size={16} color={colors.textPrimary} />}
          />
        </View>
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
  },
  inline: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSmall.fontSize,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.bodyMedium.fontSize,
    textAlign: "center",
    marginBottom: spacing.lg,
    maxWidth: 320,
    lineHeight: 20,
  },
  actionContainer: {
    minWidth: 160,
  },
});
