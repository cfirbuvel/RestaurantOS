import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { ActionButton } from "../components/ActionButton";
import { Modal } from "../components/Modal";
import { theme } from "../theme/theme";

interface Props {
  onBack: () => void;
}

export const SettingsScreen: React.FC<Props> = ({ onBack }) => {
  const { user, logout, resetPin } = useAuth();
  const { t, language, setLanguage } = useI18n();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showResetPinModal, setShowResetPinModal] = useState(false);

  const toggleLanguage = () => {
    setLanguage(language === "he" ? "en" : "he");
  };

  return (
    <View style={styles.container}>
      <Header title={t("settings.title")} onBack={onBack} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Driver Profile */}
        <Card>
          <Text style={styles.sectionTitle}>פרטי נהג</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>שם מלא:</Text>
            <Text style={styles.infoValue}>
              {user?.firstName} {user?.lastName}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>אימייל:</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>תפקיד:</Text>
            <Text style={styles.infoValue}>{user?.role || "DRIVER"}</Text>
          </View>
        </Card>

        {/* Preferences */}
        <Card>
          <Text style={styles.sectionTitle}>העדפות מערכת</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>{t("settings.language")}</Text>
              <Text style={styles.settingSub}>
                {language === "he" ? "עברית (מימין לשמאל)" : "English (LTR)"}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
              <Text style={styles.langBtnText}>{language === "he" ? "EN" : "עב"}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Security / PIN */}
        <Card>
          <Text style={styles.sectionTitle}>אבטחה וקוד גישה</Text>
          <Text style={styles.securityDesc}>
            איפוס קוד ה-PIN יחייב כניסה מחדש עם כתובת האימייל והסיסמה.
          </Text>
          <ActionButton
            label={t("settings.reset_pin")}
            onPress={() => setShowResetPinModal(true)}
            variant="warning"
            style={{ marginTop: theme.spacing.sm }}
          />
        </Card>

        {/* App Info & Logout */}
        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("settings.version")}:</Text>
            <Text style={styles.infoValue}>1.0.0 (Expo React Native)</Text>
          </View>
          <ActionButton
            label={t("settings.logout")}
            onPress={() => setShowLogoutModal(true)}
            variant="danger"
            style={{ marginTop: theme.spacing.md }}
          />
        </Card>
      </ScrollView>

      {/* Logout Confirmation */}
      <Modal
        visible={showLogoutModal}
        title={t("settings.logout")}
        message="האם אתה בטוח שברצונך להתנתק מהאפליקציה?"
        confirmLabel="התנתק"
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={async () => {
          setShowLogoutModal(false);
          await logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Reset PIN Confirmation */}
      <Modal
        visible={showResetPinModal}
        title={t("settings.reset_pin")}
        message="איפוס קוד ה-PIN ינתק אותך וידרוש התחברות עם סיסמה. להמשיך?"
        confirmLabel="אפס והתנתק"
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={async () => {
          setShowResetPinModal(false);
          await resetPin();
        }}
        onCancel={() => setShowResetPinModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flex: 1 },
  content: { padding: theme.spacing.md, gap: theme.spacing.md },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.md,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  infoLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: theme.font.sm,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: theme.font.md,
    fontWeight: "600",
  },
  settingSub: {
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
    marginTop: 2,
  },
  langBtn: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  langBtnText: {
    color: theme.colors.primary,
    fontSize: theme.font.sm,
    fontWeight: "700",
  },
  securityDesc: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    lineHeight: 20,
  },
});
