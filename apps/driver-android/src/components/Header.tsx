import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { theme } from "../theme/theme";

interface Props {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export const Header: React.FC<Props> = ({ title, onBack, rightElement }) => (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgCard} />
    <View style={styles.row}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {rightElement ? (
        <View style={styles.right}>{rightElement}</View>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.bgCard,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.text,
    fontSize: theme.font.lg,
    fontWeight: "700",
  },
  backBtn: {
    minWidth: 40,
    minHeight: theme.minTouchTarget,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backText: {
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: "700",
    transform: [{ scaleX: -1 }], // RTL arrow
  },
  right: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  placeholder: {
    minWidth: 40,
  },
});
