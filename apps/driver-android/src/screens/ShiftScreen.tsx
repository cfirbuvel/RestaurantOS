import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useAuth, DriverRecord } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { ActionButton } from "../components/ActionButton";
import { Modal } from "../components/Modal";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { theme } from "../theme/theme";

interface Props {
  onBack: () => void;
}

type ShiftAction =
  | "clock-in"
  | "clock-out"
  | "break"
  | "return-from-break"
  | "arrived-at-restaurant";

export const ShiftScreen: React.FC<Props> = ({ onBack }) => {
  const { driverRecord, refreshDriverRecord } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState<ShiftAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<ShiftAction | null>(null);

  const shift = driverRecord?.shift_status ?? "OFF_SHIFT";
  const trip = driverRecord?.trip_status ?? "NOT_STARTED";

  const doAction = async (action: ShiftAction) => {
    setLoading(action);
    try {
      await mobileApiClient.post(`/api/v1/drivers/me/${action}`, {});
      await refreshDriverRecord();
    } catch (err: any) {
      Alert.alert("שגיאה", err?.message || "פעולה נכשלה. נסה שנית.");
    } finally {
      setLoading(null);
      setConfirmAction(null);
    }
  };

  const actionFor = (action: ShiftAction) => ({
    loading: loading === action,
    disabled: loading !== null,
    onPress: () => setConfirmAction(action),
  });

  const confirmLabels: Record<ShiftAction, { title: string; msg: string; destructive: boolean }> = {
    "clock-in":            { title: "התחל משמרת",      msg: "לחץ אישור כדי להתחיל את המשמרת.",         destructive: false },
    "clock-out":           { title: "סיים משמרת",       msg: "האם אתה בטוח שברצונך לסיים את המשמרת?",  destructive: true  },
    "break":               { title: "התחל הפסקה",       msg: "תצא מהתור למשך ההפסקה.",                   destructive: false },
    "return-from-break":   { title: "חזור מהפסקה",      msg: "תחזור לתור הזמינות.",                      destructive: false },
    "arrived-at-restaurant": { title: "הגעתי למסעדה",  msg: "מאשר חזרה למסעדה ומצטרף לתור מחדש.",       destructive: false },
  };

  return (
    <View style={styles.container}>
      <Header title={t("shift.title")} onBack={onBack} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Current state */}
        <Card>
          <Text style={styles.sectionLabel}>סטטוס</Text>
          <View style={styles.badges}>
            <StatusBadge status={shift} />
            <StatusBadge status={driverRecord?.assignment_status ?? "AVAILABLE"} />
            {trip !== "NOT_STARTED" && <StatusBadge status={trip} />}
          </View>
          {driverRecord?.available_since && (
            <Text style={styles.subText}>
              {t("shift.available_since")} {new Date(driverRecord.available_since).toLocaleTimeString("he-IL")}
            </Text>
          )}
        </Card>

        {/* State-driven actions */}
        <View style={styles.actions}>
          {shift === "OFF_SHIFT" && (
            <ActionButton label={t("home.clock_in")} variant="success" {...actionFor("clock-in")} />
          )}

          {shift === "ON_SHIFT" && (
            <>
              <ActionButton label={t("home.start_break")} variant="warning" {...actionFor("break")} />
              <ActionButton label={t("home.clock_out")} variant="danger" {...actionFor("clock-out")} />
            </>
          )}

          {shift === "BREAK" && (
            <ActionButton label={t("home.return_break")} variant="success" {...actionFor("return-from-break")} />
          )}

          {trip === "RETURNING" && (
            <ActionButton label={t("shift.arrived_restaurant")} variant="primary" {...actionFor("arrived-at-restaurant")} />
          )}
        </View>
      </ScrollView>

      {/* Confirmation modal */}
      {confirmAction && (() => {
        const cfg = confirmLabels[confirmAction];
        return (
          <Modal
            visible={!!confirmAction}
            title={cfg.title}
            message={cfg.msg}
            onConfirm={() => doAction(confirmAction)}
            onCancel={() => setConfirmAction(null)}
            destructive={cfg.destructive}
          />
        );
      })()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flex: 1 },
  content: { padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: 40 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: theme.font.sm, fontWeight: "600", marginBottom: theme.spacing.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  subText: { color: theme.colors.textSecondary, fontSize: theme.font.sm, marginTop: theme.spacing.sm },
  actions: { gap: theme.spacing.sm },
});
