import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { offlineManager, NetworkStatus } from "./offline-manager";
import { useI18n } from "../i18n/i18n-context";
import { colors, spacing, typography } from "../../theme/theme";
import { WifiOff } from "lucide-react-native";

export const OfflineBanner: React.FC = () => {
  const { t } = useI18n();
  const [status, setStatus] = useState<NetworkStatus>(offlineManager.getStatus());

  useEffect(() => {
    return offlineManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  if (status === "ONLINE") return null;

  const isReconnecting = status === "RECONNECTING";

  return (
    <View
      style={{
        backgroundColor: isReconnecting ? colors.status.warning : colors.status.critical,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
      }}
    >
      {isReconnecting ? (
        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginEnd: spacing.sm }} />
      ) : (
        <WifiOff size={18} color="#FFFFFF" style={{ marginEnd: spacing.sm }} />
      )}
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: typography.bodyMedium.fontSize,
          fontWeight: "600",
        }}
      >
        {isReconnecting ? t("reconnecting") : t("offline")}
      </Text>
    </View>
  );
};
