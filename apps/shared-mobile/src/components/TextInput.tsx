import React, { useState } from "react";
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { colors, borderRadius, spacing, typography, touchTargets } from "../tokens/tokens";

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  isRTL?: boolean;
  containerStyle?: ViewStyle;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  isRTL = true,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  let borderColor = colors.input.border;
  if (error) {
    borderColor = colors.input.borderError;
  } else if (isFocused) {
    borderColor = colors.input.borderFocus;
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          style={[
            styles.label,
            { textAlign: isRTL ? "right" : "left" },
          ]}
          maxFontSizeMultiplier={1.5}
        >
          {label}
        </Text>
      ) : null}

      <RNTextInput
        style={[
          styles.input,
          {
            borderColor,
            textAlign: isRTL ? "right" : "left",
          },
          style,
        ]}
        placeholderTextColor={colors.input.placeholder}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e as any);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e as any);
        }}
        maxFontSizeMultiplier={1.5}
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-invalid={Boolean(error)}
        {...rest}
      />

      {error ? (
        <Text
          style={[
            styles.errorText,
            { textAlign: isRTL ? "right" : "left" },
          ]}
          maxFontSizeMultiplier={1.5}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={[
            styles.helperText,
            { textAlign: isRTL ? "right" : "left" },
          ]}
          maxFontSizeMultiplier={1.5}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.bodySmall.fontSize,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.input.bg,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTargets.min,
    color: colors.input.text,
    fontSize: typography.bodyMedium.fontSize,
  },
  errorText: {
    color: colors.status.error,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
    fontWeight: "500",
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
  },
});
