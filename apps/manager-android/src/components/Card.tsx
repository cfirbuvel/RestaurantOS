import React from "react";
import { View, TouchableOpacity, ViewStyle } from "react-native";
import { colors, borderRadius, spacing } from "../theme/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onClick?: () => void;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, onClick, elevated = false }) => {
  const containerStyle: ViewStyle = {
    backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    elevation: elevated ? 4 : 1,
    ...style,
  };

  if (onClick) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onClick} style={containerStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};
