import React, { useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { AuthProvider, useAuth } from "./src/core/auth/auth-context";
import { I18nProvider } from "./src/core/i18n/i18n-context";
import { OfflineBanner } from "./src/core/offline/offline-banner";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ShiftScreen } from "./src/screens/ShiftScreen";
import { DeliveryQueueScreen } from "./src/screens/DeliveryQueueScreen";
import { CurrentDeliveryScreen } from "./src/screens/CurrentDeliveryScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { theme } from "./src/theme/theme";

type NavTarget = "home" | "shift" | "queue" | "delivery" | "notifications" | "settings";

const DriverAppContent: React.FC = () => {
  const { token, isLocked, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<NavTarget>("home");

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingLogo}>🚗</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>טוען אפליקציית נהגים...</Text>
      </View>
    );
  }

  // Not authenticated or locked by PIN
  if (!token || isLocked) {
    return <AuthScreen onAuthenticated={() => setCurrentScreen("home")} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return <HomeScreen onNavigate={(screen) => setCurrentScreen(screen as NavTarget)} />;
      case "shift":
        return <ShiftScreen onBack={() => setCurrentScreen("home")} />;
      case "queue":
        return (
          <DeliveryQueueScreen
            onBack={() => setCurrentScreen("home")}
            onDeliveryAccepted={() => setCurrentScreen("delivery")}
          />
        );
      case "delivery":
        return (
          <CurrentDeliveryScreen
            onBack={() => setCurrentScreen("home")}
            onDeliveryCompleted={() => setCurrentScreen("home")}
          />
        );
      case "notifications":
        return (
          <NotificationsScreen
            onBack={() => setCurrentScreen("home")}
            onNavigate={(screen) => setCurrentScreen(screen as NavTarget)}
          />
        );
      case "settings":
        return <SettingsScreen onBack={() => setCurrentScreen("home")} />;
      default:
        return <HomeScreen onNavigate={(screen) => setCurrentScreen(screen as NavTarget)} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
      <OfflineBanner />
      {renderScreen()}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        <DriverAppContent />
      </I18nProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  loadingLogo: {
    fontSize: 56,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.md,
  },
});
