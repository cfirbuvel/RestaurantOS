import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useI18n } from "../core/i18n/i18n-context";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { theme } from "../theme/theme";
import { DeepLinkResolver } from "../../../../src/shared/deep-linking/deep-link-resolver";

interface Notification {
  id: string;
  title: string;
  body: string;
  type?: string;
  priority?: string;
  deepLink?: string;
  targetEntity?: {
    type: string;
    id: string;
  };
  created_at: string;
  read: boolean;
}

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string, id?: string) => void;
}

export const NotificationsScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await mobileApiClient.get<{ notifications: any[] }>("/api/v1/notifications");
      if (res && res.notifications) {
        setNotifications(
          res.notifications.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            type: n.type,
            priority: n.priority,
            deepLink: n.deepLink,
            targetEntity: n.targetEntity,
            created_at: n.timestamp || n.createdAt || n.created_at || new Date().toISOString(),
            read: Boolean(n.read),
          }))
        );
      }
    } catch (err) {
      console.warn("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Register device token on mount (best-effort)
    mobileApiClient
      .post("/api/v1/notifications/device-token", { token: "expo-placeholder", platform: "ANDROID_DRIVER" })
      .catch(() => {});
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleNotificationPress = async (item: Notification) => {
    // 1. Mark as read on server
    try {
      await mobileApiClient.patch(`/api/v1/notifications/${item.id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.warn("Failed to mark read:", err);
    }

    // 2. Resolve deep link & navigate
    if (item.deepLink && DeepLinkResolver.isValid(item.deepLink)) {
      try {
        const parsed = DeepLinkResolver.parse(item.deepLink);
        const resolved = DeepLinkResolver.toDriverAppRoute(parsed);
        if (onNavigate) {
          onNavigate(resolved.screen, resolved.deliveryId);
          return;
        }
      } catch (err) {
        console.warn("Deep link parse failed:", err);
      }
    }

    // 3. Fallback
    if (item.targetEntity?.type === "DELIVERY" && onNavigate) {
      onNavigate("delivery", item.targetEntity.id);
    }
  };

  return (
    <View style={styles.container}>
      <Header title={t("notifications.title") || "התראות"} onBack={onBack} />

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t("notifications.empty") || "אין התראות חדשות"}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isUrgent = item.priority === "CRITICAL" || item.priority === "HIGH";
          return (
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleNotificationPress(item)}>
              <Card style={[styles.item, !item.read && styles.unread, isUrgent && styles.urgent]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.title}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>
                  {new Date(item.created_at).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </Text>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  list: { padding: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: 40 },
  item: { gap: 4 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  unread: { borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  urgent: { borderLeftWidth: 4, borderLeftColor: theme.colors.danger },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  title: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: "700" },
  body: { color: theme.colors.textSecondary, fontSize: theme.font.sm },
  time: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.font.md },
});
