import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { colors, spacing, typography, borderRadius } from "./src/theme/theme";
import { AuthProvider, useAuth } from "./src/core/auth/auth-context";
import { I18nProvider, useI18n } from "./src/core/i18n/i18n-context";
import { OfflineBanner } from "./src/core/offline/offline-banner";
import { Header } from "./src/components/Header";
import { AuthScreen } from "./src/screens/AuthScreen";
import { BranchSelectScreen } from "./src/screens/BranchSelectScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { OrdersScreen } from "./src/screens/OrdersScreen";
import { DeliveriesScreen } from "./src/screens/DeliveriesScreen";
import { DriversScreen } from "./src/screens/DriversScreen";
import { KDSScreen } from "./src/screens/KDSScreen";
import { CustomersScreen } from "./src/screens/CustomersScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import {
  LayoutDashboard,
  ShoppingBag,
  Truck,
  Users,
  Flame,
  UserCheck,
  Bell,
  Settings as SettingsIcon,
} from "lucide-react-native";

type TabKey =
  | "dashboard"
  | "orders"
  | "deliveries"
  | "drivers"
  | "kds"
  | "customers"
  | "notifications"
  | "settings";

const ManagerAppContent: React.FC = () => {
  const { token, activeBranch } = useAuth();
  const { t, isRTL } = useI18n();

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isSelectingBranch, setIsSelectingBranch] = useState<boolean>(false);

  // If not logged in, render AuthScreen
  if (!token) {
    return <AuthScreen />;
  }

  // If no branch is selected or branch selection requested, render BranchSelectScreen
  if (!activeBranch || isSelectingBranch) {
    return <BranchSelectScreen onBranchSelected={() => setIsSelectingBranch(false)} />;
  }

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen onNavigateTab={(tab) => setActiveTab(tab as TabKey)} />;
      case "orders":
        return <OrdersScreen />;
      case "deliveries":
        return <DeliveriesScreen />;
      case "drivers":
        return <DriversScreen />;
      case "kds":
        return <KDSScreen />;
      case "customers":
        return <CustomersScreen />;
      case "notifications":
        return <NotificationsScreen onNavigateTab={(tab) => setActiveTab(tab as TabKey)} />;
      case "settings":
        return <SettingsScreen onSwitchBranch={() => setIsSelectingBranch(true)} />;
      default:
        return <DashboardScreen onNavigateTab={(tab) => setActiveTab(tab as TabKey)} />;
    }
  };

  const navTabs = [
    { key: "dashboard" as TabKey, label: t("navDashboard"), icon: LayoutDashboard },
    { key: "orders" as TabKey, label: t("navOrders"), icon: ShoppingBag },
    { key: "deliveries" as TabKey, label: t("navDeliveries"), icon: Truck },
    { key: "drivers" as TabKey, label: t("navDrivers"), icon: Users },
    { key: "kds" as TabKey, label: t("navKDS"), icon: Flame },
    { key: "customers" as TabKey, label: t("navCustomers"), icon: UserCheck },
    { key: "settings" as TabKey, label: t("navSettings"), icon: SettingsIcon },
  ];

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Offline Connectivity Banner */}
      <OfflineBanner />

      {/* Top Header */}
      <Header
        onSwitchBranch={() => setIsSelectingBranch(true)}
        onOpenNotifications={() => setActiveTab("notifications")}
        unreadNotificationsCount={2}
      />

      {/* Main Operational Surface */}
      <View style={{ flex: 1 }}>{renderActiveTabContent()}</View>

      {/* Bottom Accessible Navigation Bar (Min 48dp touch targets) */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-around",
          alignItems: "center",
          height: 64,
        }}
      >
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                minHeight: spacing.touchTargetMin,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 4,
              }}
            >
              <Icon size={20} color={isActive ? colors.brand : colors.textMuted} />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? "700" : "500",
                  color: isActive ? colors.brand : colors.textMuted,
                  marginTop: 2,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <I18nProvider initialLocale="he">
      <AuthProvider>
        <ManagerAppContent />
      </AuthProvider>
    </I18nProvider>
  );
}
