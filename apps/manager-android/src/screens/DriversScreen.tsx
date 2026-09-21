import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { Phone, Car, RefreshCw, Clock } from "lucide-react-native";

export interface DriverItem {
  id: string;
  userId: string;
  name: string;
  phone: string;
  shiftStatus: "ON_SHIFT" | "BREAK" | "OFF_SHIFT";
  assignmentStatus: "AVAILABLE" | "ASSIGNED";
  tripStatus: string;
  availableSince?: string | null;
  currentDeliveryId?: string | null;
  vehicleName?: string | null;
}

export const DriversScreen: React.FC = () => {
  const { activeBranch } = useAuth();
  const { t, isRTL } = useI18n();

  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDrivers = async () => {
    if (!activeBranch) return;
    setIsLoading(true);
    try {
      const res = await mobileApiClient.get<{ drivers: DriverItem[] }>(
        `/api/v1/drivers?branchId=${activeBranch.id}`
      );
      if (res && res.drivers) {
        setDrivers(res.drivers);
      }
    } catch (err) {
      console.error("Failed to load drivers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [activeBranch?.id]);

  const filteredDrivers = drivers.filter((d) => {
    if (filter === "ALL") return true;
    if (filter === "ON_SHIFT") return d.shiftStatus === "ON_SHIFT";
    if (filter === "AVAILABLE") return d.shiftStatus === "ON_SHIFT" && d.assignmentStatus === "AVAILABLE";
    if (filter === "ASSIGNED") return d.assignmentStatus === "ASSIGNED";
    if (filter === "BREAK") return d.shiftStatus === "BREAK";
    return true;
  });

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
            {t("driversTitle")} ({filteredDrivers.length})
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={fetchDrivers}
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

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.sm, marginBottom: spacing.md }}
        >
          {[
            { key: "ALL", label: t("all") },
            { key: "AVAILABLE", label: "זמינים בתור" },
            { key: "ASSIGNED", label: "במשלוח פעיל" },
            { key: "BREAK", label: "בהפסקה" },
            { key: "ON_SHIFT", label: "במשמרת" },
          ].map((tab) => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.7}
                onPress={() => setFilter(tab.key)}
                style={{
                  backgroundColor: isActive ? colors.brand : colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: isActive ? colors.brand : colors.borderLight,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    color: isActive ? "#000000" : colors.textSecondary,
                    fontSize: typography.bodySmall.fontSize,
                    fontWeight: "600",
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Drivers List */}
        {isLoading ? (
          <View style={{ alignItems: "center", padding: spacing.xl }}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>{t("loading")}</Text>
          </View>
        ) : filteredDrivers.length === 0 ? (
          <Card>
            <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
              לא נמצאו שליחים בקטגוריה זו.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filteredDrivers.map((driver) => {
              const statusLabel =
                driver.shiftStatus === "BREAK"
                  ? "BREAK"
                  : driver.assignmentStatus === "ASSIGNED"
                  ? "ASSIGNED"
                  : driver.shiftStatus === "ON_SHIFT"
                  ? "AVAILABLE"
                  : "OFF_SHIFT";

              return (
                <Card
                  key={driver.id}
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: spacing.md,
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
                        width: 44,
                        height: 44,
                        borderRadius: borderRadius.full,
                        backgroundColor: colors.surfaceElevated,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 16 }}>
                        {driver.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }}>
                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: spacing.sm,
                          marginBottom: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: "700",
                            color: colors.textPrimary,
                            fontSize: typography.bodyLarge.fontSize,
                          }}
                        >
                          {driver.name}
                        </Text>
                        <StatusBadge status={statusLabel} size="sm" />
                      </View>

                      <View
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: spacing.md,
                        }}
                      >
                        {driver.vehicleName && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Car size={14} color={colors.textMuted} />
                            <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textMuted }}>
                              {driver.vehicleName}
                            </Text>
                          </View>
                        )}
                        {driver.availableSince && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Clock size={14} color={colors.textMuted} />
                            <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textMuted }}>
                              {new Date(driver.availableSince).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {driver.phone && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: borderRadius.full,
                        backgroundColor: colors.brandMuted,
                        borderWidth: 1,
                        borderColor: colors.brand,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Phone size={18} color={colors.brand} />
                    </TouchableOpacity>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};
