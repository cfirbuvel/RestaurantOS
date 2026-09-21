import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { offlineManager } from "../core/offline/offline-manager";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { ActionButton } from "../components/ActionButton";
import { Modal } from "../components/Modal";
import { Phone, User, RefreshCw } from "lucide-react-native";

export interface MobileOrder {
  id: string;
  orderNumber: string;
  status: string;
  channel: string;
  orderType: string;
  total: number;
  paymentStatus: string;
  createdAt: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  destination?: {
    street?: string;
    city?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    notes?: string;
  }>;
}

export const OrdersScreen: React.FC = () => {
  const { activeBranch, hasPermission } = useAuth();
  const { t, isRTL } = useI18n();

  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeModalOrder, setActiveModalOrder] = useState<MobileOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchOrders = async () => {
    if (!activeBranch) return;
    setIsLoading(true);
    try {
      const cacheKey = `orders_${activeBranch.id}`;
      if (!offlineManager.isOnline()) {
        const cached = await offlineManager.getCachedReadOnlyData<MobileOrder[]>(cacheKey);
        if (cached) {
          setOrders(cached);
          setIsLoading(false);
          return;
        }
      }

      const res = await mobileApiClient.get<{ orders: any[] }>(
        `/api/v1/orders?branchId=${activeBranch.id}&limit=50`
      );
      if (res && res.orders) {
        const mapped: MobileOrder[] = res.orders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number || o.orderNumber || o.id.slice(0, 8),
          status: o.status,
          channel: o.channel,
          orderType: o.order_type || o.orderType || "DELIVERY",
          total: o.total_amount || o.total || 0,
          paymentStatus: o.payment_status || o.paymentStatus || "PAID",
          createdAt: o.created_at || new Date().toISOString(),
          customer: {
            name: o.customer?.name || "Customer",
            phone: o.customer?.phone,
          },
          destination: o.delivery_address || o.destination,
          items: (o.items || []).map((i: any) => ({
            name: i.product_name || i.name || "Item",
            quantity: i.quantity || 1,
            price: i.unit_price || i.price || 0,
            notes: i.special_instructions || i.notes,
          })),
        }));

        setOrders(mapped);
        await offlineManager.cacheReadOnlyData(cacheKey, mapped);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeBranch?.id]);

  const handleExecuteAction = async (action: "accept" | "start-preparation" | "ready" | "complete" | "cancel") => {
    if (!activeModalOrder) return;
    try {
      offlineManager.assertSafeMutation(`order.${action}`, true);
    } catch (err: any) {
      Alert.alert("פעולה חסומה במצב לא מקוון", err.message);
      return;
    }
    setActionLoading(true);
    try {
      await mobileApiClient.post(`/api/v1/orders/${activeModalOrder.id}/${action}`, {});
      setActiveModalOrder(null);
      await fetchOrders();
    } catch (err: any) {
      Alert.alert("שגיאה", err.message || "Failed to execute order action");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (selectedStatus === "ALL") return true;
    return o.status === selectedStatus;
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
        {/* Top Header */}
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
            {t("ordersTitle")} ({filteredOrders.length})
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={fetchOrders}
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
            { key: "CONFIRMED", label: "ממתינות לאישור" },
            { key: "ACCEPTED", label: "התקבלו" },
            { key: "IN_PREPARATION", label: "בהכנה" },
            { key: "READY", label: "מוכנות" },
            { key: "COMPLETED", label: "הושלמו" },
          ].map((tab) => {
            const isActive = selectedStatus === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.7}
                onPress={() => setSelectedStatus(tab.key)}
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

        {/* Orders List */}
        {isLoading ? (
          <View style={{ alignItems: "center", padding: spacing.xl }}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>{t("loading")}</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
              לא נמצאו הזמנות בקטגוריה זו.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filteredOrders.map((ord) => (
              <Card
                key={ord.id}
                onClick={() => setActiveModalOrder(ord)}
                style={{
                  padding: spacing.md,
                  flexDirection: isRTL ? "row-reverse" : "row",
                  justifyContent: "space-between",
                  alignItems: "center",
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
                    <Text
                      style={{
                        fontWeight: "700",
                        color: colors.textPrimary,
                        fontSize: typography.bodyLarge.fontSize,
                      }}
                    >
                      #{ord.orderNumber}
                    </Text>
                    <StatusBadge status={ord.status} size="sm" />
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted }}>
                      {ord.orderType} • {ord.channel}
                    </Text>
                  </View>

                  <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textSecondary }}>
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </Text>

                  {ord.customer?.name && (
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 4 }}>
                      {ord.customer.name} {ord.customer.phone ? `(${ord.customer.phone})` : ""}
                    </Text>
                  )}
                </View>

                <View style={{ alignItems: isRTL ? "flex-start" : "flex-end", marginStart: spacing.sm }}>
                  <Text style={{ fontSize: typography.titleSmall.fontSize, fontWeight: "700", color: colors.brand }}>
                    {ord.total} {t("currency")}
                  </Text>
                  <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
                    {ord.paymentStatus === "PAID" ? "שולם" : "טרם שולם"}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Order Details & Actions Modal */}
        {activeModalOrder && (
          <Modal
            isOpen={Boolean(activeModalOrder)}
            onClose={() => setActiveModalOrder(null)}
            title={`הזמנה #${activeModalOrder.orderNumber}`}
            footer={
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  gap: spacing.sm,
                  width: "100%",
                  justifyContent: "space-between",
                }}
              >
                {hasPermission("orders.cancel") &&
                  activeModalOrder.status !== "CANCELLED" &&
                  activeModalOrder.status !== "COMPLETED" && (
                    <ActionButton
                      variant="danger"
                      size="sm"
                      onClick={() => handleExecuteAction("cancel")}
                      loading={actionLoading}
                    >
                      {t("cancelOrder")}
                    </ActionButton>
                  )}

                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm }}>
                  {activeModalOrder.status === "CONFIRMED" && (
                    <ActionButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleExecuteAction("accept")}
                      loading={actionLoading}
                    >
                      {t("acceptOrder")}
                    </ActionButton>
                  )}
                  {activeModalOrder.status === "ACCEPTED" && (
                    <ActionButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleExecuteAction("start-preparation")}
                      loading={actionLoading}
                    >
                      {t("startPrep")}
                    </ActionButton>
                  )}
                  {activeModalOrder.status === "IN_PREPARATION" && (
                    <ActionButton
                      variant="success"
                      size="sm"
                      onClick={() => handleExecuteAction("ready")}
                      loading={actionLoading}
                    >
                      {t("markReady")}
                    </ActionButton>
                  )}
                  {activeModalOrder.status === "READY" && (
                    <ActionButton
                      variant="success"
                      size="sm"
                      onClick={() => handleExecuteAction("complete")}
                      loading={actionLoading}
                    >
                      {t("completeOrder")}
                    </ActionButton>
                  )}
                </View>
              </View>
            }
          >
            <View>
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacing.md,
                }}
              >
                <StatusBadge status={activeModalOrder.status} />
                <Text
                  style={{
                    fontWeight: "700",
                    color: colors.brand,
                    fontSize: typography.titleSmall.fontSize,
                  }}
                >
                  {activeModalOrder.total} {t("currency")} ({activeModalOrder.paymentStatus})
                </Text>
              </View>

              {/* Customer Details */}
              {activeModalOrder.customer && (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    marginBottom: spacing.md,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: spacing.xs,
                      marginBottom: 4,
                    }}
                  >
                    <User size={16} color={colors.textPrimary} />
                    <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                      {activeModalOrder.customer.name}
                    </Text>
                  </View>
                  {activeModalOrder.customer.phone && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => Linking.openURL(`tel:${activeModalOrder.customer?.phone}`)}
                      style={{
                        flexDirection: isRTL ? "row-reverse" : "row",
                        alignItems: "center",
                        gap: spacing.xs,
                      }}
                    >
                      <Phone size={14} color={colors.brand} />
                      <Text style={{ color: colors.brand, fontSize: typography.bodySmall.fontSize }}>
                        {activeModalOrder.customer.phone}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Order Items */}
              <Text
                style={{
                  marginBottom: spacing.xs,
                  fontSize: typography.bodyMedium.fontSize,
                  color: colors.textSecondary,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                פירוט מנות ({activeModalOrder.items.length}):
              </Text>
              <View style={{ gap: spacing.xs }}>
                {activeModalOrder.items.map((it, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      justifyContent: "space-between",
                      paddingVertical: spacing.xs,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: typography.bodyMedium.fontSize }}>
                      <Text style={{ fontWeight: "700" }}>{it.quantity}x </Text>
                      {it.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.bodyMedium.fontSize }}>
                      {it.price * it.quantity} {t("currency")}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Modal>
        )}
      </View>
    </ScrollView>
  );
};
