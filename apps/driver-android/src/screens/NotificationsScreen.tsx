import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useI18n } from "../core/i18n/i18n-context";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { theme } from "../theme/theme";

interface Notification {
  id: string;
  title: string;
  body: string;
  type?: string;
  created_at: string;
  read: boolean;
}

interface Props {
  onBack: () => void;
}

export const NotificationsScreen: React.FC<Props> = ({ onBack }) => {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await mobileApiClient.get<{ notifications: Notification[] }>("/api/v1/notifications");
      setNotifications(res.notifications ?? []);
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
      .post("/api/v1/notifications/device-token", { token: "expo-placeholder", platform: "android" })
      .catch(() => {});
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Header title={t("notifications.title")} onBack={onBack} />

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
              <Text style={styles.emptyText}>{t("notifications.empty")}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={[styles.item, !item.read && styles.unread]}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>
              {new Date(item.created_at).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
            </Text>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  list: { padding: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: 40 },
  item: { gap: 4 },
  unread: { borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  title: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: "700" },
  body: { color: theme.colors.textSecondary, fontSize: theme.font.sm },
  time: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.font.md },
});
