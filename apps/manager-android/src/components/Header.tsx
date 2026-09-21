import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Store, Bell, ChevronDown } from "lucide-react-native";

interface HeaderProps {
  onSwitchBranch: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onSwitchBranch,
  onOpenNotifications,
  unreadNotificationsCount = 0,
}) => {
  const { activeBranch, user } = useAuth();
  const { t, isRTL } = useI18n();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 56,
      }}
    >
      {/* Branch selector / Brand */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onSwitchBranch}
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.borderLight,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          minHeight: 40,
        }}
      >
        <Store size={18} color={colors.brand} />
        <View style={{ marginHorizontal: spacing.sm, alignItems: isRTL ? "flex-end" : "flex-start" }}>
          <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted }}>
            {t("branch")}
          </Text>
          <Text style={{ fontSize: typography.bodyMedium.fontSize, fontWeight: "600", color: colors.textPrimary }}>
            {activeBranch ? activeBranch.name : t("switchBranch")}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Actions: Notifications & Staff profile */}
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenNotifications}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: borderRadius.full,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            marginEnd: spacing.sm,
          }}
        >
          <Bell size={20} color={colors.textPrimary} />
          {unreadNotificationsCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                backgroundColor: colors.status.critical,
                width: 18,
                height: 18,
                borderRadius: borderRadius.full,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
                {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Staff initials badge */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.full,
            backgroundColor: colors.brandMuted,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.brand, fontWeight: "700", fontSize: typography.bodyMedium.fontSize }}>
            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : "M"}
          </Text>
        </View>
      </View>
    </View>
  );
};
