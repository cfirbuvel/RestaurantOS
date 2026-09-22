import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from "react-native";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { ActionButton } from "../components/ActionButton";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { mobileStorage } from "../core/auth/token-storage";
import { getOneTimeLocation } from "../core/location/location-service";
import { theme } from "../theme/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliveryAddress {
  street: string;
  houseNumber: string;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  city: string;
  gateCode?: string | null;
  parkingInstructions?: string | null;
  deliveryNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Delivery {
  id: string;
  status: string;
  orderId?: string;
  order_number?: string;
  customer?: { first_name?: string; phone?: string };
  deliveryAddress: DeliveryAddress;
  customerNotes?: string | null;
  deliveryNotes?: string | null;
  driverId?: string | null;
  driver_id?: string | null;
}

type LifecycleAction = "start" | "pickup" | "arrive" | "complete" | "release";

const CACHE_KEY = "drv_current_delivery";
const ACTIVE_STATUSES = ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED_AT_CUSTOMER_AREA"];

interface Props {
  onBack: () => void;
  onDeliveryCompleted: () => void;
}

export const CurrentDeliveryScreen: React.FC<Props> = ({ onBack, onDeliveryCompleted }) => {
  const { refreshDriverRecord, user } = useAuth();
  const { t } = useI18n();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<LifecycleAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(null);

  const normalizeDelivery = (d: any): Delivery | null => {
    if (!d) return null;
    return {
      id: d.id,
      status: d.status,
      orderId: d.orderId || d.order_id,
      customer: d.customer,
      deliveryAddress: d.deliveryAddress || d.delivery_address || {
        street: "",
        houseNumber: "",
        city: "",
      },
      customerNotes: d.customerNotes || d.customer_notes,
      deliveryNotes: d.deliveryNotes || d.delivery_notes,
      driverId: d.driverId || d.driver_id,
    };
  };

  // Load delivery from API + cache
  const loadDelivery = useCallback(async () => {
    try {
      // 1. Try cache for instant rendering
      const cached = await mobileStorage.getItem(CACHE_KEY);
      if (cached) {
        setDelivery(JSON.parse(cached));
      }

      // 2. Fetch from backend for this driver
      const res = await mobileApiClient.get<{ deliveries: any[] }>(
        `/api/v1/deliveries?driverId=${user?.id}`
      );

      const activeRaw = res?.deliveries?.find((d: any) =>
        ACTIVE_STATUSES.includes(d.status)
      );

      if (activeRaw) {
        const normalized = normalizeDelivery(activeRaw);
        setDelivery(normalized);
        await mobileStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
      } else {
        setDelivery(null);
        await mobileStorage.removeItem(CACHE_KEY);
      }
    } catch (err) {
      console.warn("Failed to load current delivery:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDelivery();
  }, [loadDelivery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDelivery();
    await refreshDriverRecord();
    setRefreshing(false);
  };

  // Execute lifecycle transition with optional spot GPS confirmation
  const doAction = async (action: LifecycleAction) => {
    if (!delivery) return;
    setActionLoading(action);
    setConfirmAction(null);

    try {
      // Spot GPS confirmation at arrive & complete (non-blocking, battery friendly)
      if (action === "arrive" || action === "complete") {
        const fix = await getOneTimeLocation();
        if (fix) {
          mobileApiClient
            .post("/api/v1/telemetry/location", {
              trackerId: delivery.id,
              latitude: fix.latitude,
              longitude: fix.longitude,
              recordedAt: new Date(fix.timestamp).toISOString(),
            })
            .catch(() => {});
        }
      }

      await mobileApiClient.post(`/api/v1/deliveries/${delivery.id}/${action}`, {});

      if (action === "complete" || action === "release") {
        await mobileStorage.removeItem(CACHE_KEY);
        setDelivery(null);
        await refreshDriverRecord();
        onDeliveryCompleted();
      } else {
        await loadDelivery();
        await refreshDriverRecord();
      }
    } catch (err: any) {
      Alert.alert(t("common.error"), err?.message || "הפעולה נכשלה. נסה שנית.");
    } finally {
      setActionLoading(null);
    }
  };

  const openNavigation = () => {
    if (!delivery?.deliveryAddress) return;
    const addr = delivery.deliveryAddress;
    const query = encodeURIComponent(
      `${addr.street || ""} ${addr.houseNumber || ""}, ${addr.city || ""}, ישראל`
    );
    const wazeUrl = `https://waze.com/ul?q=${query}&navigate=yes`;
    Linking.openURL(wazeUrl).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    });
  };

  const callCustomer = () => {
    const phone = delivery?.customer?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const status = delivery?.status ?? "";
  const canStart = status === "ASSIGNED";
  const canPickup = status === "ASSIGNED" || status === "PICKED_UP";
  const canArrive = status === "OUT_FOR_DELIVERY";
  const canComplete = status === "ARRIVED_AT_CUSTOMER_AREA";
  const canRelease = !!delivery && !["DELIVERED", "CANCELLED", "FAILED"].includes(status);

  if (!loading && !delivery) {
    return (
      <View style={styles.container}>
        <Header title={t("delivery.title")} onBack={onBack} />
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>{t("delivery.no_active")}</Text>
          <ActionButton
            label={t("home.view_queue")}
            onPress={onBack}
            variant="primary"
            style={{ marginTop: theme.spacing.lg }}
          />
        </View>
      </View>
    );
  }

  const addr = delivery?.deliveryAddress;
  const orderDisplay = delivery?.orderId
    ? delivery.orderId.slice(-6)
    : delivery?.id.slice(-6);

  return (
    <View style={styles.container}>
      <Header title={t("delivery.title")} onBack={onBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {delivery && (
          <>
            {/* Header / Status */}
            <Card>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderLabel}>{t("delivery.order_number")}</Text>
                  <Text style={styles.orderNum}>#{orderDisplay}</Text>
                </View>
                <StatusBadge status={status} />
              </View>
            </Card>

            {/* Address & Navigation */}
            <Card>
              <Text style={styles.sectionTitle}>{t("delivery.address")}</Text>
              <Text style={styles.addressPrimary}>
                {addr?.street} {addr?.houseNumber}, {addr?.city}
              </Text>
              {(addr?.floor || addr?.entrance || addr?.apartment) && (
                <Text style={styles.addressSecondary}>
                  {[
                    addr?.floor ? `קומה ${addr.floor}` : null,
                    addr?.entrance ? `כניסה ${addr.entrance}` : null,
                    addr?.apartment ? `דירה ${addr.apartment}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </Text>
              )}
              {addr?.gateCode ? (
                <Text style={styles.gateCode}>🔐 קוד שער/בניין: {addr.gateCode}</Text>
              ) : null}
              {addr?.parkingInstructions ? (
                <Text style={styles.notesText}>🅿️ חניה: {addr.parkingInstructions}</Text>
              ) : null}
              {delivery.deliveryNotes ? (
                <Text style={styles.notesText}>📝 הערות: {delivery.deliveryNotes}</Text>
              ) : null}

              <ActionButton
                label={t("delivery.navigate")}
                onPress={openNavigation}
                variant="primary"
                style={{ marginTop: theme.spacing.md }}
              />
            </Card>

            {/* Customer Details */}
            {delivery.customer?.first_name || delivery.customer?.phone ? (
              <Card>
                <Text style={styles.sectionTitle}>{t("delivery.customer")}</Text>
                <Text style={styles.customerName}>
                  {delivery.customer?.first_name ?? "לקוח"}
                </Text>
                {delivery.customer?.phone ? (
                  <TouchableOpacity onPress={callCustomer} style={styles.callRow}>
                    <Text style={styles.phoneText}>📞 {delivery.customer.phone}</Text>
                    <Text style={styles.callAction}>{t("common.call")}</Text>
                  </TouchableOpacity>
                ) : null}
              </Card>
            ) : null}

            {/* Actions */}
            <View style={styles.actionsContainer}>
              {canStart && (
                <ActionButton
                  label={t("delivery.start")}
                  onPress={() => setConfirmAction("start")}
                  loading={actionLoading === "start"}
                  disabled={actionLoading !== null}
                  variant="primary"
                />
              )}

              {canPickup && (
                <ActionButton
                  label={t("delivery.pickup")}
                  onPress={() => setConfirmAction("pickup")}
                  loading={actionLoading === "pickup"}
                  disabled={actionLoading !== null}
                  variant="primary"
                />
              )}

              {canArrive && (
                <ActionButton
                  label={t("delivery.arrive")}
                  onPress={() => setConfirmAction("arrive")}
                  loading={actionLoading === "arrive"}
                  disabled={actionLoading !== null}
                  variant="warning"
                />
              )}

              {canComplete && (
                <ActionButton
                  label={t("delivery.complete")}
                  onPress={() => setConfirmAction("complete")}
                  loading={actionLoading === "complete"}
                  disabled={actionLoading !== null}
                  variant="success"
                />
              )}

              {canRelease && (
                <ActionButton
                  label={t("delivery.release")}
                  onPress={() => setConfirmAction("release")}
                  loading={actionLoading === "release"}
                  disabled={actionLoading !== null}
                  variant="danger"
                  style={{ marginTop: theme.spacing.sm }}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Action Confirmation Modal */}
      {confirmAction && (
        <Modal
          visible={confirmAction !== null}
          title={confirmAction === "release" ? t("delivery.release") : "אישור פעולה"}
          message={
            confirmAction === "release"
              ? "האם אתה בטוח שברצונך לשחרר את המשלוח בחזרה לתור?"
              : confirmAction === "complete"
              ? "האם לאשר שהמשלוח נמסר בהצלחה ללקוח?"
              : "לאשר ביצוע שלב זה?"
          }
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          destructive={confirmAction === "release"}
          onConfirm={() => doAction(confirmAction)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flex: 1 },
  content: { padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: 40 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.xs,
  },
  orderNum: {
    color: theme.colors.text,
    fontSize: theme.font.xl,
    fontWeight: "800",
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  addressPrimary: {
    color: theme.colors.text,
    fontSize: theme.font.lg,
    fontWeight: "700",
  },
  addressSecondary: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
    marginTop: 2,
  },
  gateCode: {
    color: theme.colors.warning,
    fontSize: theme.font.md,
    fontWeight: "700",
    marginTop: theme.spacing.sm,
  },
  notesText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
    marginTop: 4,
  },
  customerName: {
    color: theme.colors.text,
    fontSize: theme.font.md,
    fontWeight: "600",
  },
  callRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.bgCardHover,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  phoneText: {
    color: theme.colors.primary,
    fontSize: theme.font.md,
    fontWeight: "700",
  },
  callAction: {
    color: theme.colors.primary,
    fontSize: theme.font.sm,
    fontWeight: "600",
  },
  actionsContainer: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.lg,
    textAlign: "center",
  },
});
