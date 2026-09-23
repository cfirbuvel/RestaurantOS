import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { Card } from "../components/Card";
import { ActionButton } from "../components/ActionButton";
import { Bell, AlertTriangle, RefreshCw, CheckCheck } from "lucide-react-native";
import { DeepLinkResolver } from "../../../../src/shared/deep-linking/deep-link-resolver";
import { NotificationType, NotificationPriority } from "../../../../src/shared/contracts/notifications";

export interface MobileNotification {
  id: string;
  title: string;
  body: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  targetEntity?: {
    type: string;
    id: string;
  };
  deepLink?: string;
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
            type: n.type,
            priority: n.priority,
            targetEntity: n.targetEntity,
            deepLink: n.deepLink,
            data: n.data,
            createdAt: n.timestamp || n.createdAt || new Date().toISOString(),
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

  const markAsRead = async (notificationId: string) => {
    try {
      await mobileApiClient.patch(`/api/v1/notifications/${notificationId}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await mobileApiClient.post(`/api/v1/notifications/mark-all-read`, {
        branchId: activeBranch?.id,
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.warn("Failed to mark all read:", err);
    }
  };

  const handleActionClick = (notif: MobileNotification) => {
    // 1. Mark as read
    markAsRead(notif.id);

    // 2. Resolve deep link if present
    if (notif.deepLink && DeepLinkResolver.isValid(notif.deepLink)) {
      try {
        const parsed = DeepLinkResolver.parse(notif.deepLink);
        const resolved = DeepLinkResolver.toManagerAppRoute(parsed);
        onNavigateTab(resolved.tab, resolved.entityId);
        return;
      } catch (err) {
        console.warn("Deep link parse failed, falling back:", err);
      }
    }

    // 3. Fallback resolution
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

  const unreadCount = notifications.filter((n) => !n.read).length;

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
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.titleMedium.fontSize,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
            >
              {t("notificationsTitle")} ({notifications.length})
            </Text>
            {unreadCount > 0 && (
              <View
                style={{
                  backgroundColor: colors.brand,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#000" }}>
                  {unreadCount} {t("unread") || "חדשות"}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            {unreadCount > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleMarkAllRead}
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <CheckCheck size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>סמן הכל כנקרא</Text>
              </TouchableOpacity>
            )}
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
                notif.priority === "CRITICAL" ||
                notif.priority === "HIGH" ||
                notif.title.toLowerCase().includes("overdue") ||
                notif.title.toLowerCase().includes("breach") ||
                notif.title.toLowerCase().includes("alert");

              return (
                <Card
                  key={notif.id}
                  elevated={!notif.read}
                  style={{
                    borderLeftWidth: isAlert ? 4 : notif.read ? 0 : 3,
                    borderLeftColor: isAlert ? colors.status.critical : colors.brand,
                    gap: spacing.sm,
                    opacity: notif.read ? 0.75 : 1.0,
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
                      variant={notif.read ? "outline" : "primary"}
                      size="sm"
                      onClick={() => handleActionClick(notif)}
                    >
                      {t("openItem") || "צפה בפרטים"}
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
