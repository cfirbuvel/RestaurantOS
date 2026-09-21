import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { offlineManager } from "../core/offline/offline-manager";
import { Card } from "../components/Card";
import {
  ShoppingBag,
  Truck,
  Users,
  Flame,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
} from "lucide-react-native";

interface OperationalOverview {
  orders: {
    todayCount: number;
    activeCount: number;
    attentionRequiredCount: number;
  };
  deliveries: {
    activeCount: number;
    waitingCount: number;
    unassignedCount: number;
  };
  drivers: {
    onShiftCount: number;
    availableCount: number;
    busyCount: number;
    onBreakCount: number;
  };
  kds: {
    activeTicketsCount: number;
    overdueTicketsCount: number;
  };
  alerts: Array<{
    id: string;
    type: "WARNING" | "CRITICAL" | "INFO";
    title: string;
    message: string;
    actionRoute?: string;
  }>;
}

interface DashboardScreenProps {
  onNavigateTab: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateTab }) => {
  const { activeBranch } = useAuth();
  const { t, isRTL } = useI18n();

  const [data, setData] = useState<OperationalOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchOverview = async () => {
    if (!activeBranch) return;
    setIsLoading(true);
    try {
      const cacheKey = `overview_${activeBranch.id}`;
      if (!offlineManager.isOnline()) {
        const cached = await offlineManager.getCachedReadOnlyData<OperationalOverview>(cacheKey);
        if (cached) {
          setData(cached);
          setIsLoading(false);
          return;
        }
      }

      const res = await mobileApiClient.get<OperationalOverview>(
        `/api/v1/analytics/operational-overview?branchId=${activeBranch.id}`
      );
      if (res) {
        setData(res);
        setLastRefreshed(new Date());
        await offlineManager.cacheReadOnlyData(cacheKey, res);
      }
    } catch (err) {
      console.error("Failed to load operational overview:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 15000);
    return () => clearInterval(interval);
  }, [activeBranch?.id]);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

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
        {/* Title & Refresh */}
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
              {t("dashboardTitle")}
            </Text>
            <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
              עודכן לאחרונה: {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={fetchOverview}
            disabled={isLoading}
            style={{
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.borderLight,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <RefreshCw size={14} color={colors.textSecondary} />
            )}
            <Text style={{ color: colors.textSecondary, fontSize: typography.bodySmall.fontSize }}>
              {t("refresh")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Operational Alerts Bar */}
        {data?.alerts && data.alerts.length > 0 && (
          <View style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
            {data.alerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                activeOpacity={0.8}
                onPress={() => alert.actionRoute && onNavigateTab(alert.actionRoute)}
                style={{
                  backgroundColor:
                    alert.type === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                  borderWidth: 1,
                  borderColor: alert.type === "CRITICAL" ? colors.status.critical : colors.status.warning,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  justifyContent: "space-between",
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
                  <AlertTriangle
                    size={20}
                    color={alert.type === "CRITICAL" ? colors.status.critical : colors.status.warning}
                  />
                  <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }}>
                    <Text
                      style={{
                        fontSize: typography.titleSmall.fontSize,
                        fontWeight: "700",
                        color: colors.textPrimary,
                      }}
                    >
                      {alert.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.bodySmall.fontSize,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {alert.message}
                    </Text>
                  </View>
                </View>
                {alert.actionRoute && <ArrowIcon size={18} color={colors.textSecondary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Key Operational Cards */}
        <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
          {/* Card 1: Orders */}
          <Card
            onClick={() => onNavigateTab("orders")}
            style={{ borderTopWidth: 4, borderTopColor: colors.status.confirmed }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ fontSize: typography.bodyMedium.fontSize, color: colors.textSecondary, fontWeight: "600" }}>
                {t("activeOrders")}
              </Text>
              <ShoppingBag size={20} color={colors.status.confirmed} />
            </View>
            <Text
              style={{
                fontSize: typography.metricValue.fontSize,
                fontWeight: "800",
                color: colors.textPrimary,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {data?.orders.activeCount ?? 0}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginTop: spacing.sm,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: typography.bodySmall.fontSize }}>
                {t("todayOrders")}: {data?.orders.todayCount ?? 0}
              </Text>
              {Number(data?.orders.attentionRequiredCount) > 0 && (
                <Text style={{ color: colors.status.warning, fontWeight: "700", fontSize: typography.bodySmall.fontSize }}>
                  {data?.orders.attentionRequiredCount} לתשומת לב
                </Text>
              )}
            </View>
          </Card>

          {/* Card 2: Deliveries */}
          <Card
            onClick={() => onNavigateTab("deliveries")}
            style={{ borderTopWidth: 4, borderTopColor: colors.status.assigned }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ fontSize: typography.bodyMedium.fontSize, color: colors.textSecondary, fontWeight: "600" }}>
                {t("activeDeliveries")}
              </Text>
              <Truck size={20} color={colors.status.assigned} />
            </View>
            <Text
              style={{
                fontSize: typography.metricValue.fontSize,
                fontWeight: "800",
                color: colors.textPrimary,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {data?.deliveries.activeCount ?? 0}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginTop: spacing.sm,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: typography.bodySmall.fontSize }}>
                {t("waitingDeliveries")}: {data?.deliveries.waitingCount ?? 0}
              </Text>
              {Number(data?.deliveries.unassignedCount) > 0 && (
                <Text style={{ color: colors.status.critical, fontWeight: "700", fontSize: typography.bodySmall.fontSize }}>
                  {data?.deliveries.unassignedCount} ללא שליח
                </Text>
              )}
            </View>
          </Card>

          {/* Card 3: Drivers */}
          <Card
            onClick={() => onNavigateTab("drivers")}
            style={{ borderTopWidth: 4, borderTopColor: colors.status.ready }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ fontSize: typography.bodyMedium.fontSize, color: colors.textSecondary, fontWeight: "600" }}>
                {t("availableDrivers")}
              </Text>
              <Users size={20} color={colors.status.ready} />
            </View>
            <Text
              style={{
                fontSize: typography.metricValue.fontSize,
                fontWeight: "800",
                color: colors.textPrimary,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {data?.drivers.availableCount ?? 0}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginTop: spacing.sm,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: typography.bodySmall.fontSize }}>
                במשמרת: {data?.drivers.onShiftCount ?? 0}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.bodySmall.fontSize }}>
                במשלוח: {data?.drivers.busyCount ?? 0}
              </Text>
            </View>
          </Card>

          {/* Card 4: KDS */}
          <Card
            onClick={() => onNavigateTab("kds")}
            style={{ borderTopWidth: 4, borderTopColor: colors.status.inPreparation }}
          >
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ fontSize: typography.bodyMedium.fontSize, color: colors.textSecondary, fontWeight: "600" }}>
                כרטיסי מטבח פעילים
              </Text>
              <Flame size={20} color={colors.status.inPreparation} />
            </View>
            <Text
              style={{
                fontSize: typography.metricValue.fontSize,
                fontWeight: "800",
                color: colors.textPrimary,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {data?.kds.activeTicketsCount ?? 0}
            </Text>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                marginTop: spacing.sm,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: typography.bodySmall.fontSize }}>סטטוס: פעיל</Text>
              {Number(data?.kds.overdueTicketsCount) > 0 ? (
                <Text style={{ color: colors.status.critical, fontWeight: "700", fontSize: typography.bodySmall.fontSize }}>
                  {data?.kds.overdueTicketsCount} חריגות SLA
                </Text>
              ) : (
                <Text style={{ color: colors.status.ready, fontSize: typography.bodySmall.fontSize }}>SLA תקין</Text>
              )}
            </View>
          </Card>
        </View>

        {/* Quick Launchpad */}
        <Text
          style={{
            fontSize: typography.titleSmall.fontSize,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: spacing.sm,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          פעולות מבצעיות מהירות
        </Text>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Card
              onClick={() => onNavigateTab("orders")}
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.md,
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingBag size={20} color={colors.status.confirmed} />
              </View>
              <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>מסילת הזמנות</Text>
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
                  אישור וביטול
                </Text>
              </View>
            </Card>
          </View>

          <View style={{ flex: 1 }}>
            <Card
              onClick={() => onNavigateTab("deliveries")}
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.md,
                  backgroundColor: "rgba(139, 92, 246, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Truck size={20} color={colors.status.assigned} />
              </View>
              <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>שיבוץ שליחים</Text>
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
                  איחוד מנות
                </Text>
              </View>
            </Card>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
