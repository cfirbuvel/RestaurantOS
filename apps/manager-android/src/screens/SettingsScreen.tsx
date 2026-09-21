import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Card } from "../components/Card";
import { ActionButton } from "../components/ActionButton";
import {
  Globe,
  Store,
  LogOut,
  PauseCircle,
  Zap,
} from "lucide-react-native";

interface SettingsScreenProps {
  onSwitchBranch: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onSwitchBranch }) => {
  const { user, activeBranch, logout } = useAuth();
  const { t, locale, setLocale, isRTL } = useI18n();

  const [onlineOrdersPaused, setOnlineOrdersPaused] = useState<boolean>(false);
  const [busyModeActive, setBusyModeActive] = useState<boolean>(false);

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xxl,
      }}
    >
      <View style={{ maxWidth: 800, width: "100%", alignSelf: "center" }}>
        <Text
          style={{
            fontSize: typography.titleMedium.fontSize,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: spacing.md,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {t("navSettings")}
        </Text>

        <View style={{ gap: spacing.md }}>
          {/* User Profile Card */}
          <Card>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.brandMuted,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.brand, fontSize: 20, fontWeight: "700" }}>
                  {user?.firstName ? user.firstName.charAt(0).toUpperCase() : "M"}
                </Text>
              </View>

              <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }}>
                <Text
                  style={{
                    fontSize: typography.titleSmall.fontSize,
                    fontWeight: "700",
                    color: colors.textPrimary,
                  }}
                >
                  {user?.firstName} {user?.lastName}
                </Text>
                <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textMuted, marginTop: 2 }}>
                  תפקיד: <Text style={{ color: colors.brand, fontWeight: "700" }}>{user?.role || "MANAGER"}</Text>
                </Text>
                {user?.email && (
                  <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
                    {user.email}
                  </Text>
                )}
              </View>
            </View>
          </Card>

          {/* Active Branch Card */}
          <Card>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  gap: spacing.md,
                  flex: 1,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.surfaceElevated,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Store size={20} color={colors.brand} />
                </View>
                <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
                  <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted }}>
                    {t("branch")} פעיל
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.titleSmall.fontSize,
                      fontWeight: "700",
                      color: colors.textPrimary,
                    }}
                  >
                    {activeBranch?.name || "לא נבחר סניף"}
                  </Text>
                </View>
              </View>

              <ActionButton variant="secondary" size="sm" onClick={onSwitchBranch}>
                {t("switchBranch")}
              </ActionButton>
            </View>
          </Card>

          {/* Language & Accessibility */}
          <Card>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <Globe size={18} color={colors.brand} />
              <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{t("language")}</Text>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setLocale("he")}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: borderRadius.md,
                  backgroundColor: locale === "he" ? colors.brand : colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: locale === "he" ? colors.brand : colors.borderLight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: locale === "he" ? "#000000" : colors.textSecondary,
                    fontWeight: "700",
                  }}
                >
                  עברית (RTL)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setLocale("en")}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: borderRadius.md,
                  backgroundColor: locale === "en" ? colors.brand : colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: locale === "en" ? colors.brand : colors.borderLight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: locale === "en" ? "#000000" : colors.textSecondary,
                    fontWeight: "700",
                  }}
                >
                  English (LTR)
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Operational Emergency Toggles */}
          <Card>
            <Text
              style={{
                fontSize: typography.titleSmall.fontSize,
                fontWeight: "700",
                color: colors.textPrimary,
                marginBottom: spacing.sm,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("quickActionsTitle")}
            </Text>

            <View style={{ gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    flex: 1,
                  }}
                >
                  <PauseCircle size={18} color={onlineOrdersPaused ? colors.status.critical : colors.textMuted} />
                  <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
                    <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                      השהיית קבלת הזמנות אונליין
                    </Text>
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
                      סגירה זמנית של ערוצי אתר / וולט
                    </Text>
                  </View>
                </View>
                <Switch
                  value={onlineOrdersPaused}
                  onValueChange={setOnlineOrdersPaused}
                  trackColor={{ false: colors.surfaceElevated, true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    flex: 1,
                  }}
                >
                  <Zap size={18} color={busyModeActive ? colors.status.warning : colors.textMuted} />
                  <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
                    <Text style={{ fontWeight: "600", color: colors.textPrimary }}>{t("busyMode")}</Text>
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
                      עדכון אוטומטי של זמני הגעה ללקוחות
                    </Text>
                  </View>
                </View>
                <Switch
                  value={busyModeActive}
                  onValueChange={setBusyModeActive}
                  trackColor={{ false: colors.surfaceElevated, true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </Card>

          {/* Logout */}
          <View style={{ marginTop: spacing.md }}>
            <ActionButton
              variant="danger"
              fullWidth
              onClick={logout}
              icon={<LogOut size={18} color="#FFFFFF" />}
            >
              {t("logout")}
            </ActionButton>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
