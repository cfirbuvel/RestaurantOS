import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Header } from "../components/Header";
import { Card } from "../components/Card";
import { ActionButton } from "../components/ActionButton";
import { theme } from "../theme/theme";
import { mobileApiClient } from "../core/network/mobile-api-client";

interface DeliveryAddress {
  street: string;
  houseNumber: string;
  city: string;
  entrance?: string;
  floor?: string;
  apartment?: string;
}

interface QueueDelivery {
  id: string;
  orderId?: string;
  status: string;
  priority?: string;
  deliveryAddress: DeliveryAddress;
  customerNotes?: string | null;
  deliveryNotes?: string | null;
}

interface Props {
  onBack: () => void;
  onDeliveryAccepted: () => void;
}

export const DeliveryQueueScreen: React.FC<Props> = ({ onBack, onDeliveryAccepted }) => {
  const { refreshDriverRecord } = useAuth();
  const { t } = useI18n();
  const [queue, setQueue] = useState<QueueDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      const res = await mobileApiClient.get<{ deliveries: QueueDelivery[] }>(
        "/api/v1/deliveries?status=AVAILABLE_FOR_ASSIGNMENT"
      );
      setQueue(res?.deliveries ?? []);
    } catch (err: any) {
      console.warn("Failed to load queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadQueue();
    setRefreshing(false);
  };

  const handleSelfAssign = async (deliveryId: string) => {
    setAssigning(deliveryId);
    try {
      await mobileApiClient.post(`/api/v1/deliveries/${deliveryId}/self-assign`, {});
      await refreshDriverRecord();
      onDeliveryAccepted();
    } catch (err: any) {
      const status = err?.status;
      if (status === 409) {
        Alert.alert("משלוח תפוס", t("queue.already_assigned") || "משלוח זה כבר שויך לנהג אחר.");
        await loadQueue(); // refresh list
      } else {
        Alert.alert(t("common.error"), err?.message || "לא ניתן לשייך משלוח.");
      }
    } finally {
      setAssigning(null);
    }
  };

  const renderItem = ({ item }: { item: QueueDelivery }) => {
    const addr = item.deliveryAddress;
    const addrStr = addr
      ? `${addr.street || ""} ${addr.houseNumber || ""}, ${addr.city || ""}`.trim()
      : "כתובת לא צוינה";

    const orderDisplay = item.orderId ? item.orderId.slice(-6) : item.id.slice(-6);

    return (
      <Card style={styles.item}>
        <View style={styles.itemTop}>
          <Text style={styles.orderNum}>
            {t("queue.order")} #{orderDisplay}
          </Text>
          {item.priority && item.priority !== "NORMAL" && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityText}>{item.priority}</Text>
            </View>
          )}
        </View>

        <Text style={styles.address}>{addrStr}</Text>

        {item.deliveryNotes ? (
          <Text style={styles.notes}>📝 {item.deliveryNotes}</Text>
        ) : null}

        <ActionButton
          label={assigning === item.id ? t("queue.assigning") : t("queue.self_assign")}
          onPress={() => handleSelfAssign(item.id)}
          loading={assigning === item.id}
          disabled={assigning !== null}
          variant="success"
          style={styles.assignBtn}
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title={t("queue.title")} onBack={onBack} />

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t("queue.empty")}</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  list: { padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: 40 },
  item: { gap: theme.spacing.sm },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNum: {
    color: theme.colors.text,
    fontSize: theme.font.md,
    fontWeight: "700",
  },
  priorityBadge: {
    backgroundColor: theme.colors.warning + "22",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  priorityText: {
    color: theme.colors.warning,
    fontSize: theme.font.xs,
    fontWeight: "700",
  },
  address: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
  },
  notes: {
    color: theme.colors.textMuted,
    fontSize: theme.font.sm,
  },
  assignBtn: { marginTop: theme.spacing.xs },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.md,
  },
});
