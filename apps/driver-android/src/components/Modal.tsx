import React from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { theme } from "../theme/theme";

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export const Modal: React.FC<Props> = ({
  visible,
  title,
  message,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  onConfirm,
  onCancel,
  destructive = false,
}) => (
  <RNModal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onCancel}
            style={[styles.btn, styles.cancelBtn]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            style={[styles.btn, destructive ? styles.destructiveBtn : styles.confirmBtn]}
            accessibilityRole="button"
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
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  dialog: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    width: "100%",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.lg,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  btn: {
    flex: 1,
    minHeight: theme.minTouchTarget,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmBtn: {
    backgroundColor: theme.colors.primary,
  },
  destructiveBtn: {
    backgroundColor: theme.colors.danger,
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: theme.font.md,
  },
  confirmText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: theme.font.md,
  },
});
