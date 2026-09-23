import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { colors, spacing, typography, touchTargets } from "../tokens/tokens";
import { ChevronRight, ChevronLeft } from "lucide-react-native";

export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  isRTL?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  rightElement,
  isRTL = true,
}) => {
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />
      <View
        style={[
          styles.row,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="חזור"
          >
            <BackIcon size={24} color={colors.brand} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.5}>
          {title}
        </Text>

        {rightElement ? (
          <View style={styles.right}>{rightElement}</View>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingTop: 44,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchTargets.min,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.textPrimary,
    fontSize: typography.titleMedium.fontSize,
    fontWeight: "700",
  },
  backBtn: {
    minWidth: touchTargets.min,
    minHeight: touchTargets.min,
    justifyContent: "center",
    alignItems: "center",
  },
  right: {
    minWidth: touchTargets.min,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    minWidth: touchTargets.min,
  },
});
