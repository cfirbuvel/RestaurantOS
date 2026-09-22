import React, { useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from "react-native";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { ActionButton } from "../components/ActionButton";
import { theme } from "../theme/theme";
import { mobileApiClient } from "../core/network/mobile-api-client";

type NavTarget = "shift" | "queue" | "delivery" | "notifications" | "settings";

interface Props {
  onNavigate: (screen: NavTarget) => void;
}

export const HomeScreen: React.FC<Props> = ({ onNavigate }) => {
  const { user, driverRecord, refreshDriverRecord } = useAuth();
  const { t } = useI18n();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDriverRecord();
    setRefreshing(false);
  };

  useEffect(() => {
    refreshDriverRecord();
  }, []);

  const shiftStatus = driverRecord?.shift_status ?? "OFF_SHIFT";
  const assignmentStatus = driverRecord?.assignment_status ?? "AVAILABLE";
  const tripStatus = driverRecord?.trip_status ?? "NOT_STARTED";
  const hasActiveDelivery = assignmentStatus === "ASSIGNED";

  return (
    <View style={styles.container}>
      <Header
        title={t("home.title")}
        rightElement={
          <TouchableOpacity onPress={() => onNavigate("settings")} style={styles.settingsBtn}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Driver greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>שלום, {user?.firstName ?? "נהג"}</Text>
          <Text style={styles.greetingSub}>{user?.email}</Text>
        </View>

        {/* Status overview */}
        <Card style={styles.statusCard}>
          <Text style={styles.sectionLabel}>סטטוס נוכחי</Text>
          <View style={styles.badges}>
            <StatusBadge status={shiftStatus} />
            <StatusBadge status={assignmentStatus} />
            {tripStatus !== "NOT_STARTED" && <StatusBadge status={tripStatus} />}
          </View>
          {driverRecord?.available_since && (
            <Text style={styles.availableSince}>
              {t("shift.available_since")} {new Date(driverRecord.available_since).toLocaleTimeString("he-IL")}
            </Text>
          )}
        </Card>

        {/* Quick actions */}
        <View style={styles.actions}>
          <ActionButton
            label={t("shift.title")}
            onPress={() => onNavigate("shift")}
            variant="primary"
          />

          {shiftStatus === "ON_SHIFT" && (
            <ActionButton
              label={t("home.view_queue")}
              onPress={() => onNavigate("queue")}
              variant="success"
              disabled={hasActiveDelivery}
            />
          )}

          {hasActiveDelivery && (
            <ActionButton
              label={t("home.current_delivery")}
              onPress={() => onNavigate("delivery")}
              variant="warning"
            />
          )}

          <ActionButton
            label={t("notifications.title")}
            onPress={() => onNavigate("notifications")}
            variant="muted"
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flex: 1 },
  content: { padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: 40 },
  greeting: { paddingTop: theme.spacing.sm },
  greetingText: { color: theme.colors.text, fontSize: theme.font.xl, fontWeight: "800" },
  greetingSub: { color: theme.colors.textSecondary, fontSize: theme.font.sm, marginTop: 2 },
  statusCard: { gap: theme.spacing.sm },
  sectionLabel: { color: theme.colors.textMuted, fontSize: theme.font.sm, fontWeight: "600" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  availableSince: { color: theme.colors.textSecondary, fontSize: theme.font.sm },
  actions: { gap: theme.spacing.sm },
  settingsBtn: { minWidth: 44, minHeight: theme.minTouchTarget, justifyContent: "center", alignItems: "flex-end" },
  settingsIcon: { fontSize: 22 },
});
