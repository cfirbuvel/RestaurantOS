import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors, spacing, typography, borderRadius } from "../theme/theme";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { ActionButton } from "../components/ActionButton";
import { Lock, ShieldAlert, Delete } from "lucide-react-native";

export const AuthScreen: React.FC = () => {
  const { loginWithPin, loginWithPassword, isLoading, error } = useAuth();
  const { t, isRTL } = useI18n();

  const [mode, setMode] = useState<"PIN" | "PASSWORD">("PIN");
  const [pin, setPin] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handlePinPress = (digit: string) => {
    if (isLoading) return;
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        loginWithPin(next).then((success) => {
          if (!success) {
            setTimeout(() => setPin(""), 600);
          }
        });
      }
    }
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePasswordSubmit = async () => {
    if (!email || !password) return;
    await loginWithPassword(email, password);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
            padding: spacing.xl,
            alignItems: "center",
          }}
        >
          {/* Brand Header */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: borderRadius.md,
              backgroundColor: colors.brandMuted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.md,
            }}
          >
            <Lock size={28} color={colors.brand} />
          </View>

          <Text
            style={{
              fontSize: typography.titleLarge.fontSize,
              fontWeight: "700",
              color: colors.textPrimary,
              marginBottom: spacing.xs,
              textAlign: "center",
            }}
          >
            {t("appTitle")}
          </Text>

          <Text
            style={{
              fontSize: typography.bodyMedium.fontSize,
              color: colors.textSecondary,
              marginBottom: spacing.lg,
              textAlign: "center",
            }}
          >
            {t("loginTitle")}
          </Text>

          {/* Error Alert */}
          {error && (
            <View
              style={{
                width: "100%",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderWidth: 1,
                borderColor: colors.status.critical,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.lg,
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
              }}
            >
              <ShieldAlert size={18} color={colors.status.critical} />
              <Text
                style={{
                  color: colors.status.critical,
                  fontSize: typography.bodySmall.fontSize,
                  fontWeight: "600",
                  marginHorizontal: spacing.sm,
                  flex: 1,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {error}
              </Text>
            </View>
          )}

          {mode === "PIN" ? (
            <View style={{ width: "100%", alignItems: "center" }}>
              {/* PIN Dots */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  marginBottom: spacing.xl,
                  gap: spacing.md,
                }}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <View
                      key={idx}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: borderRadius.full,
                        backgroundColor: filled ? colors.brand : colors.surfaceElevated,
                        borderWidth: 2,
                        borderColor: filled ? colors.brand : colors.borderLight,
                      }}
                    />
                  );
                })}
              </View>

              {/* Keypad Grid */}
              <View style={{ width: "100%", maxWidth: 300, gap: spacing.md, marginBottom: spacing.lg }}>
                {[
                  ["1", "2", "3"],
                  ["4", "5", "6"],
                  ["7", "8", "9"],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                    {row.map((d) => (
                      <TouchableOpacity
                        key={d}
                        activeOpacity={0.7}
                        onPress={() => handlePinPress(d)}
                        style={{
                          flex: 1,
                          height: 60,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.surfaceElevated,
                          borderWidth: 1,
                          borderColor: colors.borderLight,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                {/* Bottom row (Empty / 0 / Delete) */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handlePinPress("0")}
                    style={{
                      flex: 1,
                      height: 60,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>0</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handlePinDelete}
                    style={{
                      flex: 1,
                      height: 60,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Delete size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mode Toggle */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setMode("PASSWORD")}
                style={{ padding: spacing.sm }}
              >
                <Text
                  style={{
                    color: colors.brand,
                    fontSize: typography.bodySmall.fontSize,
                    textDecorationLine: "underline",
                  }}
                >
                  {t("orLoginWithEmail")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: "100%" }}>
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  style={{
                    fontSize: typography.bodySmall.fontSize,
                    color: colors.textSecondary,
                    marginBottom: spacing.xs,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {t("email")}
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{
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
              </View>

              <View style={{ marginBottom: spacing.lg }}>
                <Text
                  style={{
                    fontSize: typography.bodySmall.fontSize,
                    color: colors.textSecondary,
                    marginBottom: spacing.xs,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {t("password")}
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={{
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
              </View>

              <ActionButton
                onClick={handlePasswordSubmit}
                loading={isLoading}
                fullWidth
                style={{ marginBottom: spacing.md }}
              >
                {t("loginBtn")}
              </ActionButton>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setMode("PIN")}
                style={{ padding: spacing.sm, alignItems: "center" }}
              >
                <Text
                  style={{
                    color: colors.brand,
                    fontSize: typography.bodySmall.fontSize,
                    textDecorationLine: "underline",
                  }}
                >
                  {t("enterPin")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
