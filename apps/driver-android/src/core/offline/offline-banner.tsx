import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { offlineManager } from "./offline-manager";
import { useI18n } from "../i18n/i18n-context";

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(offlineManager.isOnline);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const { t } = useI18n();

  useEffect(() => {
    offlineManager.start();
    const unsub = offlineManager.subscribe((online) => setIsOnline(online));
    return unsub;
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOnline ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, opacity]);

  return (
    <Animated.View style={[styles.banner, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>⚠ {t("common.offline")}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 999,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
