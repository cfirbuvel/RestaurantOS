import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../core/auth/auth-context";
import { useI18n } from "../core/i18n/i18n-context";
import { ActionButton } from "../components/ActionButton";
import { theme } from "../theme/theme";

interface Props {
  onAuthenticated?: () => void;
}

// ─── Main Auth Screen Orchestrator ───────────────────────────────────────────

export const AuthScreen: React.FC<Props> = ({ onAuthenticated }) => {
  const { isLocked, pinIsSet, token } = useAuth();
  const [inSetupMode, setInSetupMode] = useState(false);

  // If returning driver with configured PIN and session is locked
  if (isLocked && pinIsSet) {
    return <PinUnlockScreen onAuthenticated={onAuthenticated} />;
  }

  // If driver just logged in with password but hasn't set a PIN yet
  if ((token && !pinIsSet) || inSetupMode) {
    return <PinSetupScreen onAuthenticated={onAuthenticated} />;
  }

  // First-time or logged-out driver: credentials form
  return (
    <CredentialsScreen
      onLoginSuccess={() => {
        if (!pinIsSet) {
          setInSetupMode(true);
        } else {
          onAuthenticated?.();
        }
      }}
    />
  );
};

// ─── Step 1: Email + Password ─────────────────────────────────────────────────

const CredentialsScreen: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const { loginWithPassword, error, clearError, isLoading } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    clearError();
    const ok = await loginWithPassword(email.trim(), password);
    if (ok) {
      onLoginSuccess();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoText}>🚗</Text>
          <Text style={styles.appName}>{t("auth.title")}</Text>
          <Text style={styles.subtitle}>כניסת נהג למערכת המשלוחים</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t("auth.email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(v) => {
              clearError();
              setEmail(v);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={theme.colors.textMuted}
            placeholder="driver@restaurantos.test"
          />

          <Text style={styles.label}>{t("auth.password")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(v) => {
              clearError();
              setPassword(v);
            }}
            secureTextEntry
            placeholderTextColor={theme.colors.textMuted}
            placeholder="••••••••"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <ActionButton
            label={isLoading ? t("auth.logging_in") : t("auth.login")}
            onPress={handleLogin}
            loading={isLoading}
            disabled={!email || !password || isLoading}
            style={{ marginTop: theme.spacing.md }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Step 2a: PIN Setup (First login) ────────────────────────────────────────

const PinSetupScreen: React.FC<{ onAuthenticated?: () => void }> = ({ onAuthenticated }) => {
  const { setupPin, error, clearError } = useAuth();
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLocalError("");
    clearError();

    if (pin.length < 4) {
      setLocalError("קוד ה-PIN חייב להכיל לפחות 4 ספרות.");
      return;
    }
    if (pin !== confirm) {
      setLocalError(t("pin.setup.mismatch") || "קודי ה-PIN אינם תואמים.");
      return;
    }

    setLoading(true);
    try {
      await setupPin(pin);
      onAuthenticated?.();
    } catch {
      setLocalError("שמירת קוד ה-PIN נכשלה. אנא נסה שנית.");
    } finally {
      setLoading(false);
    }
  };

  const displayedError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoText}>🔐</Text>
          <Text style={styles.appName}>{t("pin.setup.title")}</Text>
          <Text style={styles.subtitle}>{t("pin.setup.subtitle")}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>קוד PIN חדש (4-6 ספרות)</Text>
          <TextInput
            style={[styles.input, styles.pinInput]}
            value={pin}
            onChangeText={(v) => {
              setLocalError("");
              clearError();
              setPin(v.replace(/\D/g, "").slice(0, 6));
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholderTextColor={theme.colors.textMuted}
            placeholder="••••"
          />

          <Text style={styles.label}>{t("pin.setup.confirm")}</Text>
          <TextInput
            style={[styles.input, styles.pinInput]}
            value={confirm}
            onChangeText={(v) => {
              setLocalError("");
              clearError();
              setConfirm(v.replace(/\D/g, "").slice(0, 6));
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholderTextColor={theme.colors.textMuted}
            placeholder="••••"
          />

          {displayedError ? <Text style={styles.error}>{displayedError}</Text> : null}

          <ActionButton
            label={loading ? t("common.loading") : t("pin.setup.confirm_btn")}
            onPress={handleSetup}
            loading={loading}
            disabled={pin.length < 4 || confirm.length < 4 || loading}
            style={{ marginTop: theme.spacing.md }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Step 2b: PIN Unlock (Returning driver) ───────────────────────────────────

const PinUnlockScreen: React.FC<{ onAuthenticated?: () => void }> = ({ onAuthenticated }) => {
  const { unlockWithPin, resetPin, error, clearError } = useAuth();
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (pin.length < 4) return;
    clearError();
    setLoading(true);
    const ok = await unlockWithPin(pin);
    setLoading(false);
    if (ok) {
      onAuthenticated?.();
    } else {
      setPin("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoText}>🔓</Text>
          <Text style={styles.appName}>{t("pin.unlock.title")}</Text>
          <Text style={styles.subtitle}>הזן את קוד ה-PIN שלך לכניסה מהירה</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, styles.pinInput]}
            value={pin}
            onChangeText={(v) => {
              clearError();
              setPin(v.replace(/\D/g, "").slice(0, 6));
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholderTextColor={theme.colors.textMuted}
            placeholder="••••"
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <ActionButton
            label={loading ? t("common.loading") : "פתח אפליקציה"}
            onPress={handleUnlock}
            loading={loading}
            disabled={pin.length < 4 || loading}
            style={{ marginTop: theme.spacing.md }}
          />

          <TouchableOpacity
            onPress={async () => {
              await resetPin();
            }}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>{t("pin.unlock.forgot")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner: {
    flexGrow: 1,
    padding: theme.spacing.xl,
    justifyContent: "center",
  },
  logo: { alignItems: "center", marginBottom: theme.spacing.xxl },
  logoText: { fontSize: 56, marginBottom: theme.spacing.sm },
  appName: {
    color: theme.colors.text,
    fontSize: theme.font.xl,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  form: { gap: theme.spacing.sm },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.sm,
    fontWeight: "600",
    marginTop: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.font.md,
    minHeight: theme.minTouchTarget,
    textAlign: "right",
  },
  pinInput: {
    fontSize: 28,
    letterSpacing: 10,
    textAlign: "center",
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.font.sm,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  forgotBtn: {
    alignItems: "center",
    marginTop: theme.spacing.lg,
    minHeight: theme.minTouchTarget,
    justifyContent: "center",
  },
  forgotText: {
    color: theme.colors.primary,
    fontSize: theme.font.sm,
  },
});
