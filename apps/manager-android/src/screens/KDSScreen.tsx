import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { Flame, RefreshCw } from "lucide-react-native";

export interface KDSStation {
  id: string;
  name: string;
  displayName?: string;
  stationType: string;
  isActive: boolean;
}

export interface KDSTicketItem {
  id: string;
  orderNumber: string;
  stationId: string;
  status: string;
  createdAt: string;
  targetCompletionTime?: string;
  items: Array<{ name: string; quantity: number }>;
}

export const KDSScreen: React.FC = () => {
  const { activeBranch } = useAuth();
  const { t, isRTL } = useI18n();

  const [stations, setStations] = useState<KDSStation[]>([]);
  const [tickets, setTickets] = useState<KDSTicketItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchKDSData = async () => {
    if (!activeBranch) return;
    setIsLoading(true);
    try {
      const [stationRes, ticketRes] = await Promise.all([
        mobileApiClient.get<{ stations: any[] }>(`/api/v1/kds/stations?branchId=${activeBranch.id}`),
        mobileApiClient.get<{ tickets: any[] }>(`/api/v1/kds/tickets?branchId=${activeBranch.id}&status=QUEUED,STARTED,READY`),
      ]);

      if (stationRes && stationRes.stations) {
        setStations(
          stationRes.stations.map((s: any) => ({
            id: s.id,
            name: s.name,
            displayName: s.display_name || s.name,
            stationType: s.station_type || s.stationType || "KITCHEN",
            isActive: Boolean(s.is_active),
          }))
        );
      }

      if (ticketRes && ticketRes.tickets) {
        setTickets(
          ticketRes.tickets.map((t: any) => ({
            id: t.id,
            orderNumber: t.order_number || t.orderNumber || "ORD",
            stationId: t.station_id || t.stationId,
            status: t.status,
            createdAt: t.created_at || new Date().toISOString(),
            targetCompletionTime: t.target_completion_time,
            items: (t.items || []).map((i: any) => ({
              name: i.name || i.product_name || "Item",
              quantity: i.quantity || 1,
            })),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load KDS data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKDSData();
  }, [activeBranch?.id]);

  const now = Date.now();

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
          <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
            <Text
              style={{
                fontSize: typography.titleMedium.fontSize,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
            >
              {t("kdsTitle")}
            </Text>
            <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
              סקירת עומסים ו-SLA למנהל (אינו מחליף את מסך הטבחים)
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={fetchKDSData}
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
        ) : stations.length === 0 ? (
          <Card>
            <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
              לא הוגדרו עמדות מטבח לסניף זה.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {/* Station Overview Cards */}
            <View style={{ gap: spacing.md }}>
              {stations.map((station) => {
                const stationTickets = tickets.filter((t) => t.stationId === station.id && t.status !== "READY");
                const overdueCount = stationTickets.filter(
                  (t) => t.targetCompletionTime && new Date(t.targetCompletionTime).getTime() < now
                ).length;

                const isBacklogged = overdueCount > 0 || stationTickets.length > 5;

                return (
                  <Card
                    key={station.id}
                    style={{
                      borderTopWidth: 4,
                      borderTopColor: isBacklogged ? colors.status.warning : colors.status.ready,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: spacing.xs,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",
                          color: colors.textPrimary,
                          fontSize: typography.titleSmall.fontSize,
                        }}
                      >
                        {station.displayName || station.name}
                      </Text>
                      <Flame size={18} color={isBacklogged ? colors.status.warning : colors.textMuted} />
                    </View>

                    <Text
                      style={{
                        fontSize: typography.metricValue.fontSize,
                        fontWeight: "800",
                        color: colors.textPrimary,
                        textAlign: isRTL ? "right" : "left",
                      }}
                    >
                      {stationTickets.length}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.caption.fontSize,
                        color: colors.textMuted,
                        marginBottom: spacing.sm,
                        textAlign: isRTL ? "right" : "left",
                      }}
                    >
                      כרטיסים בעבודה
                    </Text>

                    <View
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ color: colors.textMuted, fontSize: typography.bodySmall.fontSize }}>
                        עמדה: {station.stationType}
                      </Text>
                      {overdueCount > 0 ? (
                        <Text style={{ color: colors.status.critical, fontWeight: "700", fontSize: typography.bodySmall.fontSize }}>
                          {overdueCount} חריגות SLA
                        </Text>
                      ) : (
                        <Text style={{ color: colors.status.ready, fontSize: typography.bodySmall.fontSize }}>SLA תקין</Text>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>

            {/* Active Kitchen Tickets List */}
            <Text
              style={{
                marginTop: spacing.md,
                fontSize: typography.titleSmall.fontSize,
                fontWeight: "700",
                color: colors.textPrimary,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              כרטיסים פעילים במסילה ({tickets.length}):
            </Text>
            <View style={{ gap: spacing.sm }}>
              {tickets.map((ticket) => {
                const isOverdue =
                  ticket.targetCompletionTime && new Date(ticket.targetCompletionTime).getTime() < now;
                return (
                  <Card
                    key={ticket.id}
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderRightWidth: isOverdue ? 4 : 0,
                      borderRightColor: isOverdue ? colors.status.critical : "transparent",
                    }}
                  >
                    <View style={{ flex: 1, alignItems: isRTL ? "flex-end" : "flex-start" }}>
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: spacing.sm,
                          marginBottom: spacing.xs,
                        }}
                      >
                        <Text style={{ fontWeight: "700", color: colors.textPrimary }}>#{ticket.orderNumber}</Text>
                        <StatusBadge status={ticket.status} size="sm" />
                        {isOverdue && (
                          <Text style={{ color: colors.status.critical, fontSize: typography.caption.fontSize, fontWeight: "700" }}>
                            ⚠️ חריגת זמן הכנה
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textSecondary }}>
                        {ticket.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                      </Text>
                    </View>

                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted }}>
                      {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </Card>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};
