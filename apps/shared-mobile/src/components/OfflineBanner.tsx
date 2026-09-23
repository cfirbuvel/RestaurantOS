import React, { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, Animated, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../tokens/tokens";
import { offlineManager, NetworkStatus } from "../core/offline-manager";
import { WifiOff } from "lucide-react-native";

export interface OfflineBannerProps {
  customOfflineText?: string;
  customReconnectingText?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  customOfflineText,
  customReconnectingText,
}) => {
  const [status, setStatus] = useState<NetworkStatus>(offlineManager.getStatus());
  const opacity = useRef(new Animated.Value(status === "ONLINE" ? 0 : 1)).current;

  useEffect(() => {
    return offlineManager.subscribe((newStatus) => {
      setStatus(newStatus);
      Animated.timing(opacity, {
        toValue: newStatus === "ONLINE" ? 0 : 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  }, [opacity]);

  if (status === "ONLINE") return null;

  const isReconnecting = status === "RECONNECTING";
  const bgColor = isReconnecting ? colors.status.warning : colors.status.offline;
  const displayText = isReconnecting
    ? customReconnectingText || "מתחבר מחדש לשרת..."
    : customOfflineText || "אין חיבור לאינטרנט - מצב אופליין פעיל";

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: bgColor, opacity },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.content}>
        {isReconnecting ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
        ) : (
          <WifiOff size={18} color="#FFFFFF" style={styles.icon} />
        )}
        <Text style={styles.text} maxFontSizeMultiplier={1.5}>
          {displayText}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginEnd: spacing.sm,
  },
  text: {
    color: "#FFFFFF",
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: "700",
  },
});
