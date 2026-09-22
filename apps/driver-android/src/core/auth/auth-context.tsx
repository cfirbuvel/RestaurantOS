import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { mobileApiClient } from "../network/mobile-api-client";
import { mobileStorage } from "./token-storage";
import { hashPin } from "./pin-hash";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DriverProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  permissions: string[];
}

export interface DriverRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  user_id: string;
  shift_status: "OFF_SHIFT" | "ON_SHIFT" | "BREAK";
  assignment_status: "AVAILABLE" | "ASSIGNED";
  trip_status: "NOT_STARTED" | "IN_TRANSIT" | "AT_CUSTOMER" | "RETURNING";
  available_since: string | null;
  can_self_assign: boolean;
}

interface AuthContextType {
  token: string | null;
  user: DriverProfile | null;
  driverRecord: DriverRecord | null;
  isLoading: boolean;
  isLocked: boolean;
  error: string | null;
  pinIsSet: boolean;
  clearError: () => void;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  resetPin: () => Promise<void>;
  refreshDriverRecord: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  TOKEN: "drv_auth_token",
  USER: "drv_user_profile",
  PIN_HASH: "drv_pin_hash",
  BRANCH: "drv_active_branch",
};

// ─── Security: Error Sanitizer ────────────────────────────────────────────────
// Never expose raw runtime exceptions, database errors, or stack traces to the UI.

function sanitizeAuthError(err: any, fallback: string): string {
  if (!err) return fallback;
  const msg = typeof err?.message === "string" ? err.message.toLowerCase() : "";
  const status = err?.status || err?.statusCode;

  if (status === 429 || msg.includes("locked") || msg.includes("too many") || msg.includes("rate limit")) {
    return "חשבון נחסם זמנית עקב נסיונות כושלים רבים. נסה שוב מאוחר יותר.";
  }
  if (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("offline") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("network request failed")
  ) {
    return "שגיאת תקשורת: לא ניתן להתחבר לשרת. בדוק את החיבור לרשת.";
  }
  if (status === 401 || msg.includes("invalid credentials") || msg.includes("unauthorized")) {
    return "כתובת אימייל או סיסמה שגויים.";
  }
  if (status === 403) {
    return "אין הרשאה מתאימה לגישה לאפליקציית הנהגים.";
  }

  // Safe fallback — avoid leaking technical exceptions
  return fallback;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DriverProfile | null>(null);
  const [driverRecord, setDriverRecord] = useState<DriverRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinIsSet, setPinIsSet] = useState(false);

  const clearError = () => setError(null);

  const loadDriverRecord = useCallback(async () => {
    try {
      const res = await mobileApiClient.get<{ driver: DriverRecord }>("/api/v1/drivers/me");
      if (res?.driver) {
        setDriverRecord(res.driver);
      }
    } catch (err) {
      console.warn("Could not load driver record:", err);
    }
  }, []);

  // Initialize from SecureStore on app cold start
  useEffect(() => {
    const init = async () => {
      try {
        const savedToken = await mobileStorage.getItem(KEYS.TOKEN);
        const savedUserStr = await mobileStorage.getItem(KEYS.USER);
        const savedPinHash = await mobileStorage.getItem(KEYS.PIN_HASH);
        const savedBranch = await mobileStorage.getItem(KEYS.BRANCH);

        const hasPin = Boolean(savedPinHash);
        const hasSession = Boolean(savedToken && savedUserStr);

        setPinIsSet(hasPin);

        if (hasSession && hasPin) {
          // App has valid stored credentials and a configured PIN -> lock app awaiting PIN
          setIsLocked(true);
        } else if (hasSession && !hasPin) {
          // Session exists but no PIN setup yet -> hydrate session and prompt PIN setup
          const parsedUser: DriverProfile = JSON.parse(savedUserStr!);
          setToken(savedToken);
          setUser(parsedUser);
          mobileApiClient.setToken(savedToken!);
          if (savedBranch) mobileApiClient.setBranchId(savedBranch);
          setIsLocked(false);
          await loadDriverRecord();
        } else {
          // No session
          setIsLocked(false);
        }
      } catch (err) {
        console.error("Auth hydration failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadDriverRecord]);

  const refreshDriverRecord = async () => {
    if (!token) return;
    await loadDriverRecord();
  };

  const loginWithPassword = async (email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await mobileApiClient.post<any>(
        "/api/v1/auth/login",
        { email, password: pass },
        { skipAuth: true }
      );

      if (res?.session) {
        const authToken = res.session.token;
        const profile: DriverProfile = {
          id: res.user?.id || res.session.userId,
          email: res.user?.email || email,
          firstName: res.user?.firstName || "נהג",
          lastName: res.user?.lastName || "",
          phone: res.user?.phone,
          role: res.session.role || "DRIVER",
          permissions: res.session.permissions || [],
        };

        setToken(authToken);
        setUser(profile);
        mobileApiClient.setToken(authToken);

        if (res.session.branchId) {
          mobileApiClient.setBranchId(res.session.branchId);
          await mobileStorage.setItem(KEYS.BRANCH, res.session.branchId);
        }

        await mobileStorage.setItem(KEYS.TOKEN, authToken);
        await mobileStorage.setItem(KEYS.USER, JSON.stringify(profile));

        await loadDriverRecord();
        return true;
      }
      setError("כתובת אימייל או סיסמה שגויים.");
      return false;
    } catch (err: any) {
      setError(sanitizeAuthError(err, "כתובת אימייל או סיסמה שגויים."));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const setupPin = async (pin: string): Promise<void> => {
    setError(null);
    try {
      const hashed = await hashPin(pin);
      await mobileStorage.setItem(KEYS.PIN_HASH, hashed);
      setPinIsSet(true);
      setIsLocked(false);
    } catch (err) {
      console.error("PIN setup failed:", err);
      setError("שמירת קוד ה-PIN נכשלה. נסה שנית.");
    }
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    setError(null);
    try {
      const storedHash = await mobileStorage.getItem(KEYS.PIN_HASH);
      if (!storedHash) {
        setIsLocked(false);
        return false;
      }

      const hashed = await hashPin(pin);
      if (hashed !== storedHash) {
        setError("קוד PIN שגוי. אנא נסה שנית.");
        return false;
      }

      // Restore session from SecureStore
      const savedToken = await mobileStorage.getItem(KEYS.TOKEN);
      const savedUserStr = await mobileStorage.getItem(KEYS.USER);
      const savedBranch = await mobileStorage.getItem(KEYS.BRANCH);

      if (savedToken && savedUserStr) {
        const parsedUser: DriverProfile = JSON.parse(savedUserStr);
        setToken(savedToken);
        setUser(parsedUser);
        mobileApiClient.setToken(savedToken);
        if (savedBranch) mobileApiClient.setBranchId(savedBranch);
        setIsLocked(false);
        await loadDriverRecord();
        return true;
      }

      // Token no longer valid in storage
      setError("פג תוקף ההתחברות. אנא התחבר מחדש עם אימייל וסיסמה.");
      setIsLocked(false);
      return false;
    } catch (err) {
      console.error("Unlock with PIN error:", err);
      setError("שגיאה באימות קוד PIN.");
      return false;
    }
  };

  const resetPin = async (): Promise<void> => {
    try {
      await mobileStorage.removeItem(KEYS.PIN_HASH);
      await mobileStorage.removeItem(KEYS.TOKEN);
      await mobileStorage.removeItem(KEYS.USER);
      await mobileStorage.removeItem(KEYS.BRANCH);
    } catch (err) {
      console.warn("Error clearing storage on reset PIN:", err);
    } finally {
      setPinIsSet(false);
      setIsLocked(false);
      setToken(null);
      setUser(null);
      setDriverRecord(null);
      mobileApiClient.setToken("");
      mobileApiClient.setBranchId("");
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await mobileApiClient.post("/api/v1/auth/logout", {}).catch(() => {});
      }
    } finally {
      setToken(null);
      setUser(null);
      setDriverRecord(null);
      setPinIsSet(false);
      setIsLocked(false);
      mobileApiClient.setToken("");
      mobileApiClient.setBranchId("");
      await mobileStorage.removeItem(KEYS.TOKEN).catch(() => {});
      await mobileStorage.removeItem(KEYS.USER).catch(() => {});
      await mobileStorage.removeItem(KEYS.BRANCH).catch(() => {});
      await mobileStorage.removeItem(KEYS.PIN_HASH).catch(() => {});
    }
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (["OWNER", "ADMIN", "MANAGER", "DRIVER"].includes(user.role)) return true;
    return user.permissions?.includes(perm) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        driverRecord,
        isLoading,
        isLocked,
        error,
        pinIsSet,
        clearError,
        loginWithPassword,
        setupPin,
        unlockWithPin,
        resetPin,
        refreshDriverRecord,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
