import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { Card } from "../components/Card";
import { ActionButton } from "../components/ActionButton";
import { Bell, AlertTriangle, RefreshCw } from "lucide-react-native";

export interface MobileNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  createdAt: string;
  read: boolean;
}

interface NotificationsScreenProps {
  onNavigateTab: (tab: string, targetId?: string) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onNavigateTab }) => {
  const { activeBranch } = useAuth();
  const { t, isRTL } = useI18n();

  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await mobileApiClient.get<{ notifications: any[] }>(`/api/v1/notifications`);
      if (res && res.notifications) {
        setNotifications(
          res.notifications.map((n: any) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            data: n.data,
            createdAt: n.createdAt || new Date().toISOString(),
            read: Boolean(n.read),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeBranch?.id]);

  const handleActionClick = (notif: MobileNotification) => {
    if (notif.data?.actionRoute) {
      onNavigateTab(notif.data.actionRoute, notif.data?.targetId);
    } else if (notif.title.toLowerCase().includes("delivery")) {
      onNavigateTab("deliveries");
    } else if (notif.title.toLowerCase().includes("kds") || notif.title.toLowerCase().includes("kitchen")) {
      onNavigateTab("kds");
    } else {
      onNavigateTab("orders");
    }
  };

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
        {/* Header */}
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: typography.titleMedium.fontSize,
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            {t("notificationsTitle")} ({notifications.length})
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={fetchNotifications}
            disabled={isLoading}
            style={{
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.borderLight,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            }}
          >
            <RefreshCw size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ alignItems: "center", padding: spacing.xl }}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>{t("loading")}</Text>
          </View>
        ) : notifications.length === 0 ? (
          <Card>
            <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
              {t("noNotifications")}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {notifications.map((notif) => {
              const isAlert =
                notif.title.toLowerCase().includes("overdue") ||
                notif.title.toLowerCase().includes("breach") ||
                notif.title.toLowerCase().includes("alert");

              return (
                <Card
                  key={notif.id}
                  elevated={!notif.read}
                  style={{
                    borderLeftWidth: isAlert ? 4 : 0,
                    borderLeftColor: isAlert ? colors.status.critical : "transparent",
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: spacing.sm }}>
                      {isAlert ? (
                        <AlertTriangle size={18} color={colors.status.critical} />
                      ) : (
                        <Bell size={18} color={colors.brand} />
                      )}
                      <Text
                        style={{
                          fontWeight: "700",
                          color: colors.textPrimary,
                          fontSize: typography.titleSmall.fontSize,
                        }}
                      >
                        {notif.title}
                      </Text>
                    </View>
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted }}>
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: typography.bodyMedium.fontSize,
                      color: colors.textSecondary,
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {notif.body}
                  </Text>

                  <View style={{ flexDirection: isRTL ? "row" : "row-reverse", paddingTop: spacing.xs }}>
                    <ActionButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleActionClick(notif)}
                    >
                      {t("openItem")}
                    </ActionButton>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};
