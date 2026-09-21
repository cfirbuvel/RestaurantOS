import React, { useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth, ActiveBranch } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { Card } from "../components/Card";
import { Store, Check, ArrowRight, ArrowLeft } from "lucide-react-native";

interface BranchSelectScreenProps {
  onBranchSelected: () => void;
}

export const BranchSelectScreen: React.FC<BranchSelectScreenProps> = ({ onBranchSelected }) => {
  const { branches, activeBranch, selectBranch, refreshBranches, isLoading } = useAuth();
  const { t, isRTL } = useI18n();

  useEffect(() => {
    refreshBranches();
  }, []);

  const handleSelect = async (branch: ActiveBranch) => {
    await selectBranch(branch);
    onBranchSelected();
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
      contentContainerStyle={{
        padding: spacing.lg,
      }}
    >
      <View style={{ maxWidth: 600, width: "100%", alignSelf: "center" }}>
        <Text
          style={{
            fontSize: typography.titleLarge.fontSize,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: spacing.xs,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {t("switchBranch")}
        </Text>
        <Text
          style={{
            fontSize: typography.bodyMedium.fontSize,
            color: colors.textSecondary,
            marginBottom: spacing.xl,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          בחר סניף לפעילות ניהולית ומבצעית:
        </Text>

        {isLoading ? (
          <View style={{ alignItems: "center", padding: spacing.xl }}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>
              {t("loading")}
            </Text>
          </View>
        ) : branches.length === 0 ? (
          <Card>
            <Text style={{ textAlign: "center", padding: spacing.xl, color: colors.textMuted }}>
              לא נמצאו סניפים פעילים עבור משתמש זה.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {branches.map((b) => {
              const isSelected = activeBranch?.id === b.id;
              return (
                <Card
                  key={b.id}
                  onClick={() => handleSelect(b)}
                  elevated={isSelected}
                  style={{
                    flexDirection: isRTL ? "row-reverse" : "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderColor: isSelected ? colors.brand : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    padding: spacing.lg,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: spacing.md,
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: borderRadius.md,
                        backgroundColor: isSelected ? colors.brandMuted : colors.surfaceElevated,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Store size={22} color={isSelected ? colors.brand : colors.textSecondary} />
                    </View>
                    <View style={{ alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }}>
                      <Text
                        style={{
                          fontSize: typography.titleSmall.fontSize,
                          fontWeight: "700",
                          color: colors.textPrimary,
                        }}
                      >
                        {b.name}
                      </Text>
                      <Text style={{ fontSize: typography.bodySmall.fontSize, color: colors.textMuted, marginTop: 2 }}>
                        {b.phone || b.slug}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {isSelected ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Check size={18} color={colors.brand} />
                        <Text
                          style={{
                            color: colors.brand,
                            fontSize: typography.bodySmall.fontSize,
                            fontWeight: "600",
                          }}
                        >
                          פעיל כעת
                        </Text>
                      </View>
                    ) : (
                      <ArrowIcon size={20} color={colors.textSecondary} />
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};
