import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { colors, borderRadius, spacing, typography, touchTargets } from "../tokens/tokens";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react-native";

export type AlertType = "info" | "success" | "warning" | "error";

export interface AlertProps {
  type?: AlertType;
  title?: string;
  message: string;
  onDismiss?: () => void;
  isRTL?: boolean;
  style?: ViewStyle;
}

export const Alert: React.FC<AlertProps> = ({
  type = "info",
  title,
  message,
  onDismiss,
  isRTL = true,
  style,
}) => {
  let bgColor = "rgba(14, 165, 233, 0.12)";
  let borderColor = "rgba(14, 165, 233, 0.35)";
  let textColor = colors.status.info;
  let IconComponent = Info;

  switch (type) {
    case "success":
      bgColor = "rgba(16, 185, 129, 0.12)";
      borderColor = "rgba(16, 185, 129, 0.35)";
      textColor = colors.status.success;
      IconComponent = CheckCircle2;
      break;
    case "warning":
      bgColor = "rgba(245, 158, 11, 0.12)";
      borderColor = "rgba(245, 158, 11, 0.35)";
      textColor = colors.status.warning;
      IconComponent = AlertTriangle;
      break;
    case "error":
      bgColor = "rgba(239, 68, 68, 0.12)";
      borderColor = "rgba(239, 68, 68, 0.35)";
      textColor = colors.status.error;
      IconComponent = AlertCircle;
      break;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
        style,
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.iconContainer}>
        <IconComponent size={20} color={textColor} />
      </View>

      <View style={[styles.textContainer, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        {title ? (
          <Text style={[styles.title, { color: textColor }]} maxFontSizeMultiplier={1.5}>
            {title}
          </Text>
        ) : null}
        <Text
          style={[styles.message, { textAlign: isRTL ? "right" : "left" }]}
          maxFontSizeMultiplier={1.5}
        >
          {message}
        </Text>
      </View>

      {onDismiss ? (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissBtn}
          accessibilityRole="button"
          accessibilityLabel="סגור הודעה"
        >
          <X size={16} color={textColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  iconContainer: {
    marginHorizontal: spacing.xs,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  title: {
    fontSize: typography.bodyMediumBold.fontSize,
    fontWeight: "700",
    marginBottom: 2,
  },
  message: {
    color: colors.textPrimary,
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: 18,
  },
  dismissBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
