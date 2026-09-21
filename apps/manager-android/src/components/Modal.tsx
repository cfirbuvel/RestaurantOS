import React from "react";
import { Modal as RNModal, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { colors, borderRadius, spacing, typography } from "../theme/theme";
import { X } from "lucide-react-native";
import { useI18n } from "../core/i18n/i18n-context";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  const { isRTL } = useI18n();

  return (
    <RNModal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
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
          {/* Modal Header */}
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
            >
              {title}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={{ padding: spacing.xs }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Modal Body */}
          <ScrollView
            style={{ padding: spacing.lg }}
            contentContainerStyle={{ paddingBottom: spacing.lg }}
          >
            {children}
          </ScrollView>

          {/* Modal Footer */}
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
