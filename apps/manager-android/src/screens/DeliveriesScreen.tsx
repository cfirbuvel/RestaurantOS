import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { offlineManager } from "../core/offline/offline-manager";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { ActionButton } from "../components/ActionButton";
import { Modal } from "../components/Modal";
import { Truck, Users, Layers, MapPin, RefreshCw } from "lucide-react-native";

export interface MobileDelivery {
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  driverId?: string;
  driverName?: string;
  destination: {
    street?: string;
    houseNumber?: string;
    city?: string;
  };
  customer: {
    name?: string;
    phone?: string;
  };
  amountToCollect: number;
  isPaid: boolean;
  createdAt: string;
}

export interface AvailableDriver {
  driverId: string;
  userId: string;
  driverName: string;
  queuePosition: number;
  availableSince: string;
}

export interface BatchSuggestion {
  id: string;
  deliveryIds: string[];
  deliveries: Array<{ id: string; orderNumber: string; address: string }>;
  suggestedDriverId?: string;
  suggestedDriverName?: string;
  explanation: string;
  estimatedTimeSavingsMinutes: number;
}

export const DeliveriesScreen: React.FC = () => {
  const { activeBranch } = useAuth();
  const { t, isRTL } = useI18n();

  const [activeTab, setActiveTab] = useState<"QUEUE" | "BATCHES">("QUEUE");
  const [deliveries, setDeliveries] = useState<MobileDelivery[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [batches, setBatches] = useState<BatchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Assign Driver Modal
  const [assignModalDelivery, setAssignModalDelivery] = useState<MobileDelivery | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchDeliveriesAndQueue = async () => {
    if (!activeBranch) return;
    setIsLoading(true);
    try {
      const cacheKey = `deliveries_${activeBranch.id}`;
      if (!offlineManager.isOnline()) {
        const cached = await offlineManager.getCachedReadOnlyData<{
          deliveries: MobileDelivery[];
          drivers: AvailableDriver[];
          batches: BatchSuggestion[];
        }>(cacheKey);
        if (cached) {
          setDeliveries(cached.deliveries || []);
          setAvailableDrivers(cached.drivers || []);
          setBatches(cached.batches || []);
          setIsLoading(false);
          return;
        }
      }

      // 1. Fetch live deliveries
      const delRes = await mobileApiClient.get<{ deliveries: any[] }>(
        `/api/v1/deliveries?branchId=${activeBranch.id}`
      );

      // 2. Fetch driver FIFO queue
      const driversRes = await mobileApiClient.get<{ queue: any[] }>(
        `/api/v1/drivers?branchId=${activeBranch.id}&status=AVAILABLE`
      );

      // 3. Fetch batch suggestions
      const batchesRes = await mobileApiClient.get<{ suggestions: any[] }>(
        `/api/v1/deliveries/batches?branchId=${activeBranch.id}`
      );

      if (delRes && delRes.deliveries) {
        const mappedDeliveries: MobileDelivery[] = delRes.deliveries.map((d) => ({
          id: d.id,
          orderId: d.order_id || d.orderId,
          orderNumber: d.order_number || d.orderNumber || d.id.slice(0, 8),
          status: d.status,
          driverId: d.driver_id || d.driverId,
          driverName: d.driver_name || d.driverName,
          destination: d.delivery_address || d.destination || {},
          customer: {
            name: d.customer_name || d.customer?.name,
            phone: d.customer_phone || d.customer?.phone,
          },
          amountToCollect: d.amount_to_collect || d.amountToCollect || 0,
          isPaid: Boolean(d.is_paid ?? d.isPaid),
          createdAt: d.created_at || new Date().toISOString(),
        }));
        setDeliveries(mappedDeliveries);

        const mappedDrivers: AvailableDriver[] = (driversRes?.queue || []).map((q, idx) => ({
          driverId: q.id,
          userId: q.user_id || q.userId,
          driverName: q.name || q.driverName || `שליח ${idx + 1}`,
          queuePosition: idx + 1,
          availableSince: q.available_since || q.availableSince || new Date().toISOString(),
        }));
        setAvailableDrivers(mappedDrivers);

        const mappedBatches: BatchSuggestion[] = (batchesRes?.suggestions || []).map((b) => ({
          id: b.id,
          deliveryIds: b.delivery_ids || b.deliveryIds || [],
          deliveries: b.deliveries || [],
          suggestedDriverId: b.suggested_driver_id || b.suggestedDriverId,
          suggestedDriverName: b.suggested_driver_name || b.suggestedDriverName,
          explanation: b.explanation || "איחוד יעיל על פי מסלול גיאוגרפי",
          estimatedTimeSavingsMinutes: b.estimated_savings_minutes || b.estimatedTimeSavingsMinutes || 12,
        }));
        setBatches(mappedBatches);

        await offlineManager.cacheReadOnlyData(cacheKey, {
          deliveries: mappedDeliveries,
          drivers: mappedDrivers,
          batches: mappedBatches,
        });
      }
    } catch (err) {
      console.error("Failed to load delivery dispatch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveriesAndQueue();
  }, [activeBranch?.id]);

  const handleAssignDriver = async () => {
    if (!assignModalDelivery || !selectedDriverId) return;
    try {
      offlineManager.assertSafeMutation("delivery.assign", true);
    } catch (err: any) {
      Alert.alert("פעולה חסומה", err.message);
      return;
    }
    setActionLoading(true);
    try {
      await mobileApiClient.post(`/api/v1/deliveries/${assignModalDelivery.id}/assign`, {
        driverId: selectedDriverId,
      });
      setAssignModalDelivery(null);
      await fetchDeliveriesAndQueue();
    } catch (err: any) {
      Alert.alert("שגיאה", err.message || "Failed to assign driver");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseDelivery = async (deliveryId: string) => {
    try {
      offlineManager.assertSafeMutation("delivery.release", true);
    } catch (err: any) {
      Alert.alert("פעולה חסומה", err.message);
      return;
    }
    try {
      await mobileApiClient.post(`/api/v1/deliveries/${deliveryId}/release`, {});
      await fetchDeliveriesAndQueue();
    } catch (err: any) {
      Alert.alert("שגיאה", err.message || "Failed to release delivery");
    }
  };

  const handleApproveBatch = async (batchId: string) => {
    try {
      offlineManager.assertSafeMutation("batch.approve", true);
    } catch (err: any) {
      Alert.alert("פעולה חסומה", err.message);
      return;
    }
    try {
      await mobileApiClient.post(`/api/v1/deliveries/batches/${batchId}/approve`, {});
      await fetchDeliveriesAndQueue();
    } catch (err: any) {
      Alert.alert("שגיאה", err.message || "Failed to approve batch");
    }
  };

  const handleRejectBatch = async (batchId: string) => {
    try {
      offlineManager.assertSafeMutation("batch.reject", true);
    } catch (err: any) {
      Alert.alert("פעולה חסומה", err.message);
      return;
    }
    try {
      await mobileApiClient.post(`/api/v1/deliveries/batches/${batchId}/reject`, {});
      await fetchDeliveriesAndQueue();
    } catch (err: any) {
      Alert.alert("שגיאה", err.message || "Failed to reject batch");
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
            {t("deliveriesTitle")}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={fetchDeliveriesAndQueue}
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

        {/* Tabs: Queue vs Batches */}
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm, marginBottom: spacing.md }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab("QUEUE")}
            style={{
              flex: 1,
              height: 44,
              backgroundColor: activeTab === "QUEUE" ? colors.brand : colors.surfaceElevated,
              borderWidth: 1,
              borderColor: activeTab === "QUEUE" ? colors.brand : colors.borderLight,
              borderRadius: borderRadius.md,
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
            }}
          >
            <Truck size={18} color={activeTab === "QUEUE" ? "#000000" : colors.textSecondary} />
            <Text
              style={{
                color: activeTab === "QUEUE" ? "#000000" : colors.textSecondary,
                fontWeight: "700",
              }}
            >
              {t("deliveryQueue")} ({deliveries.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab("BATCHES")}
            style={{
              flex: 1,
              height: 44,
              backgroundColor: activeTab === "BATCHES" ? colors.brand : colors.surfaceElevated,
              borderWidth: 1,
              borderColor: activeTab === "BATCHES" ? colors.brand : colors.borderLight,
              borderRadius: borderRadius.md,
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
            }}
          >
            <Layers size={18} color={activeTab === "BATCHES" ? "#000000" : colors.textSecondary} />
            <Text
              style={{
                color: activeTab === "BATCHES" ? "#000000" : colors.textSecondary,
                fontWeight: "700",
              }}
            >
              {t("suggestedBatches")} ({batches.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "QUEUE" ? (
          <View style={{ gap: spacing.md }}>
            {/* Driver FIFO Queue Bar */}
            <Card style={{ backgroundColor: colors.surfaceElevated }}>
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacing.sm,
                }}
              >
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: spacing.xs }}>
                  <Users size={16} color={colors.status.ready} />
                  <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                    תור שליחים זמינים (FIFO):
                  </Text>
                </View>
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted }}>
                  {availableDrivers.length} שליחים ממתינים
                </Text>
              </View>

              {availableDrivers.length === 0 ? (
                <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.status.warning, textAlign: isRTL ? "right" : "left" }}>
                  ⚠️ אין שליחים זמינים בתור כרגע
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: 4 }}>
                  {availableDrivers.map((d) => (
                    <View
                      key={d.driverId}
                      style={{
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.borderLight,
                        borderRadius: borderRadius.sm,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textPrimary }}>
                        <Text style={{ color: colors.brand, fontWeight: "700" }}>#{d.queuePosition} </Text>
                        {d.driverName}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </Card>

            {/* Deliveries List */}
            {deliveries.length === 0 ? (
              <Card>
                <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
                  אין משלוחים בתור כעת.
                </Text>
              </Card>
            ) : (
              deliveries.map((del) => (
                <Card
                  key={del.id}
                  style={{
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
                      <Text
                        style={{
                          fontWeight: "700",
                          color: colors.textPrimary,
                          fontSize: typography.titleSmall.fontSize,
                        }}
                      >
                        #{del.orderNumber}
                      </Text>
                      <StatusBadge status={del.status} size="sm" />
                    </View>
                    {del.amountToCollect > 0 ? (
                      <Text style={{ color: colors.status.warning, fontWeight: "700" }}>
                        לגבות: {del.amountToCollect} {t("currency")}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.status.ready, fontSize: typography.caption.fontSize }}>שולם</Text>
                    )}
                  </View>

                  {/* Destination */}
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <MapPin size={16} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: typography.bodyMedium.fontSize }}>
                      {del.destination.street} {del.destination.houseNumber}, {del.destination.city}
                    </Text>
                  </View>

                  {/* Driver Assignment Status & Action */}
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      paddingTop: spacing.sm,
                      marginTop: spacing.xs,
                    }}
                  >
                    <View>
                      {del.driverName ? (
                        <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.status.assigned, fontWeight: "600" }}>
                          שליח: {del.driverName}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.status.critical, fontWeight: "600" }}>
                          ללא שליח משויך
                        </Text>
                      )}
                    </View>

                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      {del.driverId ? (
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReleaseDelivery(del.id)}
                        >
                          {t("releaseDelivery")}
                        </ActionButton>
                      ) : (
                        <ActionButton
                          variant="primary"
                          size="sm"
                          onClick={() => setAssignModalDelivery(del)}
                        >
                          {t("assignDriver")}
                        </ActionButton>
                      )}
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : (
          /* Batches View */
          <View style={{ gap: spacing.md }}>
            {batches.length === 0 ? (
              <Card>
                <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
                  אין המלצות איחוד משלוחים פעילות כרגע.
                </Text>
              </Card>
            ) : (
              batches.map((batch) => (
                <Card key={batch.id} elevated style={{ borderLeftWidth: 4, borderLeftColor: colors.brand }}>
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: colors.textPrimary,
                        fontSize: typography.titleSmall.fontSize,
                      }}
                    >
                      המלצת איחוד: {batch.deliveryIds.length} משלוחים
                    </Text>
                    <Text style={{ color: colors.status.ready, fontWeight: "700", fontSize: typography.bodySmall.fontSize }}>
                      חיסכון: ~{batch.estimatedTimeSavingsMinutes} דקות
                    </Text>
                  </View>

                  <Text
                    style={{
                      marginBottom: spacing.md,
                      fontSize: typography.bodyMedium.fontSize,
                      color: colors.textSecondary,
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    💡 {batch.explanation}
                  </Text>

                  {/* Batch Deliveries */}
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      padding: spacing.sm,
                      borderRadius: borderRadius.md,
                      marginBottom: spacing.md,
                    }}
                  >
                    {batch.deliveries.map((del) => (
                      <View
                        key={del.id}
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          justifyContent: "space-between",
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontWeight: "600", color: colors.textPrimary, fontSize: typography.bodySmall.fontSize }}>
                          #{del.orderNumber}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: typography.bodySmall.fontSize }}>
                          {del.address}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Approve / Reject Actions */}
                  <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm, justifyContent: "flex-end" }}>
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRejectBatch(batch.id)}
                    >
                      {t("rejectBatch")}
                    </ActionButton>
                    <ActionButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveBatch(batch.id)}
                    >
                      {t("approveBatch")}
                    </ActionButton>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Assign Driver Modal */}
        {assignModalDelivery && (
          <Modal
            isOpen={Boolean(assignModalDelivery)}
            onClose={() => setAssignModalDelivery(null)}
            title={`שיבוץ שליח להזמנה #${assignModalDelivery.orderNumber}`}
            footer={
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm }}>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setAssignModalDelivery(null)}
                >
                  {t("cancel")}
                </ActionButton>
                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={handleAssignDriver}
                  loading={actionLoading}
                  disabled={!selectedDriverId}
                >
                  {t("confirm")} שיבוץ
                </ActionButton>
              </View>
            }
          >
            <View>
              <Text
                style={{
                  marginBottom: spacing.md,
                  fontSize: typography.bodyMedium.fontSize,
                  color: colors.textSecondary,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                בחר שליח מתוך תור השליחים הזמינים:
              </Text>

              {availableDrivers.length === 0 ? (
                <Text style={{ color: colors.status.critical, fontWeight: "600" }}>
                  אין כרגע שליחים זמינים במשמרת.
                </Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {availableDrivers.map((d) => {
                    const isSelected = selectedDriverId === d.driverId;
                    return (
                      <TouchableOpacity
                        key={d.driverId}
                        activeOpacity={0.7}
                        onPress={() => setSelectedDriverId(d.driverId)}
                        style={{
                          flexDirection: isRTL ? "row-reverse" : "row",
                          alignItems: "center",
                          gap: spacing.md,
                          padding: spacing.md,
                          backgroundColor: isSelected ? colors.brandMuted : colors.surface,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.brand : colors.borderLight,
                          borderRadius: borderRadius.md,
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: isSelected ? colors.brand : colors.textMuted,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSelected && (
                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: colors.brand,
                              }}
                            />
                          )}
                        </View>
                        <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }}>
                          <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                            #{d.queuePosition} • {d.driverName}
                          </Text>
                          <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
                            זמין מזה: {new Date(d.availableSince).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </Modal>
        )}
      </View>
    </ScrollView>
  );
};
