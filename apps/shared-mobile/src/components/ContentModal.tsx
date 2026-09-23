import React from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { colors, borderRadius, spacing, typography, touchTargets } from "../tokens/tokens";
import { X } from "lucide-react-native";

export interface ContentModalProps {
  isOpen?: boolean;
  visible?: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isRTL?: boolean;
}

export const ContentModal: React.FC<ContentModalProps> = ({
  isOpen,
  visible,
  onClose,
  title,
  children,
  footer,
  isRTL = true,
}) => {
  const isModalVisible = visible !== undefined ? visible : Boolean(isOpen);

  return (
    <RNModal
      visible={isModalVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.md,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.borderLight,
            borderRadius: borderRadius.lg,
            width: "100%",
            maxWidth: 520,
            maxHeight: "85%",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: typography.titleSmall.fontSize,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
              maxFontSizeMultiplier={1.5}
            >
              {title}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="סגור חלון"
              style={{
                minWidth: touchTargets.min,
                minHeight: touchTargets.min,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={{ padding: spacing.lg }}
            contentContainerStyle={{ paddingBottom: spacing.lg }}
          >
            {children}
          </ScrollView>

          {/* Footer */}
          {footer && (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                flexDirection: isRTL ? "row" : "row-reverse",
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.surface,
              }}
            >
              {footer}
            </View>
          )}
        </View>
      </View>
    </RNModal>
  );
};
