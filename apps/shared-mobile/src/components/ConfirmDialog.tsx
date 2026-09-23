import React from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { colors, borderRadius, spacing, typography, touchTargets } from "../tokens/tokens";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  onConfirm,
  onCancel,
  destructive = false,
}) => (
  <RNModal
    transparent
    animationType="fade"
    visible={visible}
    onRequestClose={onCancel}
    accessibilityViewIsModal={true}
  >
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <Text style={styles.title} maxFontSizeMultiplier={1.5}>{title}</Text>
        {message ? (
          <Text style={styles.message} maxFontSizeMultiplier={1.5}>{message}</Text>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onCancel}
            style={[styles.btn, styles.cancelBtn]}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            style={[styles.btn, destructive ? styles.destructiveBtn : styles.confirmBtn]}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </RNModal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSmall.fontSize,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.bodyMedium.fontSize,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    minHeight: touchTargets.min,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  confirmBtn: {
    backgroundColor: colors.button.primaryBg,
  },
  destructiveBtn: {
    backgroundColor: colors.button.dangerBg,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: typography.bodyMedium.fontSize,
  },
  confirmText: {
    color: colors.button.primaryText,
    fontWeight: "700",
    fontSize: typography.bodyMedium.fontSize,
  },
});
