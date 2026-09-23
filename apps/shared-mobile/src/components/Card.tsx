import React from "react";
import { View, TouchableOpacity, ViewStyle, StyleProp } from "react-native";
import { colors, borderRadius, spacing, elevation } from "../tokens/tokens";

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onClick?: () => void; // Backward-compat alias
  elevated?: boolean;
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  onClick,
  elevated = false,
  accessibilityLabel,
}) => {
  const handlePress = onPress || onClick;

  const baseCardStyle: ViewStyle = {
    backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    elevation: elevated ? elevation.medium : elevation.low,
  };

  if (handlePress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[baseCardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[baseCardStyle, style]}
    >
      {children}
    </View>
  );
};
