import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { mobileApiClient } from "../core/network/mobile-api-client";
import { Card } from "../components/Card";
import { ActionButton } from "../components/ActionButton";
import { Phone, Search, Star } from "lucide-react-native";

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isVip?: boolean;
  totalOrders: number;
  totalSpent: number;
  notes?: string;
}

export const CustomersScreen: React.FC = () => {
  const { activeBranch } = useAuth();
  const { t, isRTL } = useI18n();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await mobileApiClient.get<{ customers: any[] }>(
        `/api/v1/crm/customers?query=${encodeURIComponent(searchQuery)}`
      );
      if (res && res.customers) {
        setCustomers(
          res.customers.map((c: any) => ({
            id: c.id,
            name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Customer",
            phone: c.phone || "",
            email: c.email,
            isVip: Boolean(c.is_vip),
            totalOrders: c.total_orders_count || 0,
            totalSpent: c.total_spent_amount || 0,
            notes: c.internal_notes,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to search customers:", err);
    } finally {
      setIsLoading(false);
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
        <Text
          style={{
            fontSize: typography.titleMedium.fontSize,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: spacing.md,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {t("customersTitle")}
        </Text>

        {/* Search Input & Button */}
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: spacing.sm, marginBottom: spacing.lg }}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="חפש לפי טלפון או שם לקוח..."
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={{
              flex: 1,
              height: 48,
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.borderLight,
              borderRadius: borderRadius.md,
              color: colors.textPrimary,
              paddingHorizontal: spacing.md,
              fontSize: typography.bodyMedium.fontSize,
              textAlign: isRTL ? "right" : "left",
            }}
          />
          <ActionButton onClick={handleSearch} loading={isLoading} icon={<Search size={18} color="#000000" />}>
            {t("search")}
          </ActionButton>
        </View>

        {/* Results */}
        {isLoading ? (
          <View style={{ alignItems: "center", padding: spacing.xl }}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>{t("loading")}</Text>
          </View>
        ) : hasSearched && customers.length === 0 ? (
          <Card>
            <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
              לא נמצאו לקוחות התואמים לחיפוש זה.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {customers.map((c) => (
              <Card key={c.id}>
                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: spacing.xs,
                  }}
                >
                  <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: spacing.sm }}>
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: typography.titleSmall.fontSize,
                        color: colors.textPrimary,
                      }}
                    >
                      {c.name}
                    </Text>
                    {c.isVip && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          borderRadius: borderRadius.sm,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          gap: 2,
                        }}
                      >
                        <Star size={12} color={colors.brand} />
                        <Text style={{ color: colors.brand, fontSize: typography.caption.fontSize, fontWeight: "700" }}>
                          {t("vipCustomer")}
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(`tel:${c.phone}`)}
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Phone size={14} color={colors.brand} />
                    <Text
                      style={{
                        color: colors.brand,
                        fontSize: typography.bodySmall.fontSize,
                        fontWeight: "600",
                      }}
                    >
                      {c.phone}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    gap: spacing.lg,
                    marginVertical: spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textMuted }}>
                    {t("totalOrders")}:{" "}
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{c.totalOrders}</Text>
                  </Text>
                  <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textMuted }}>
                    {t("totalSpent")}:{" "}
                    <Text style={{ color: colors.brand, fontWeight: "700" }}>
                      {c.totalSpent} {t("currency")}
                    </Text>
                  </Text>
                </View>

                {c.notes && (
                  <View
                    style={{
                      backgroundColor: colors.surfaceElevated,
                      padding: spacing.sm,
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textSecondary }}>
                      📝 {c.notes}
                    </Text>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};
