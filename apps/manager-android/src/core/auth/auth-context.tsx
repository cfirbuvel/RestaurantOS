import React, { createContext, useContext, useState, useEffect } from "react";
import { mobileApiClient } from "../network/mobile-api-client";
import { mobileStorage } from "./token-storage";

export interface UserProfile {
  id: string;
  email?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  permissions: string[];
}

export interface ActiveBranch {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: any;
}

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  activeBranch: ActiveBranch | null;
  branches: ActiveBranch[];
  isLoading: boolean;
  error: string | null;
  loginWithPin: (pin: string, branchId?: string) => Promise<boolean>;
  loginWithPassword: (email: string, pass: string) => Promise<boolean>;
  selectBranch: (branch: ActiveBranch) => Promise<void>;
  refreshBranches: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEYS = {
  TOKEN: "ro_auth_token",
  USER: "ro_user_profile",
  BRANCH: "ro_active_branch",
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeBranch, setActiveBranch] = useState<ActiveBranch | null>(null);
  const [branches, setBranches] = useState<ActiveBranch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from secure storage on startup
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedToken = await mobileStorage.getItem(STORAGE_KEYS.TOKEN);
        const savedUserStr = await mobileStorage.getItem(STORAGE_KEYS.USER);
        const savedBranchStr = await mobileStorage.getItem(STORAGE_KEYS.BRANCH);

        if (savedToken && savedUserStr) {
          const parsedUser = JSON.parse(savedUserStr);
          setToken(savedToken);
          setUser(parsedUser);
          mobileApiClient.setToken(savedToken);

          if (savedBranchStr) {
            const parsedBranch = JSON.parse(savedBranchStr);
            setActiveBranch(parsedBranch);
            mobileApiClient.setBranchId(parsedBranch.id);
          }
        }
      } catch (err) {
        console.error("Auth hydration failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const refreshBranches = async () => {
    if (!token) return;
    try {
      const res = await mobileApiClient.get<any>("/api/v1/branches");
      if (res && res.branches) {
        setBranches(res.branches);
        if (!activeBranch && res.branches.length > 0) {
          await selectBranch(res.branches[0]);
        }
      }
    } catch (err: any) {
      console.error("Failed to load branches:", err);
    }
  };

function sanitizeAuthError(err: any, fallbackMessage: string): string {
  console.error("[AuthError]", err);

  const rawMessage = typeof err?.message === "string" ? err.message : "";
  const status = err?.status || err?.statusCode || (err as any)?.response?.status;

  // Rate limit / lockout
  if (
    status === 429 ||
    rawMessage.toLowerCase().includes("locked") ||
    rawMessage.toLowerCase().includes("too many")
  ) {
    return "חשבון נחסם זמנית עקב נסיונות כושלים מרובים. נסה שוב בעוד מספר דקות.";
  }

  // Connectivity issues
  if (
    rawMessage.toLowerCase().includes("network") ||
    rawMessage.toLowerCase().includes("failed to fetch") ||
    rawMessage.toLowerCase().includes("offline") ||
    rawMessage.toLowerCase().includes("timeout") ||
    rawMessage.toLowerCase().includes("econnrefused") ||
    rawMessage.toLowerCase().includes("network request failed")
  ) {
    return "שגיאת תקשורת: לא ניתן להתחבר לשרת. ודא שהשרת פועל ושיש חיבור לרשת.";
  }

  // Return generic user-facing message, never internal stack or property details
  return fallbackMessage;
}

  const loginWithPin = async (pin: string, branchId?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: any = { pin };
      if (branchId) payload.branchId = branchId;

      const res = await mobileApiClient.post<any>("/api/v1/auth/pin-login", payload, {
        skipAuth: true,
      });

      if (res && res.session) {
        const authToken = res.session.token;
        const profile: UserProfile = {
          id: res.user?.id || res.session.userId,
          email: res.user?.email,
          firstName: res.user?.firstName || "Manager",
          lastName: res.user?.lastName || "",
          phone: res.user?.phone,
          role: res.session.role || "MANAGER",
          permissions: res.session.permissions || [],
        };

        setToken(authToken);
        setUser(profile);
        mobileApiClient.setToken(authToken);

        await mobileStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
        await mobileStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));

        await refreshBranches();
        return true;
      }
      return false;
    } catch (err: any) {
      setError(sanitizeAuthError(err, "קוד PIN שגוי. אנא נסה שנית."));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPassword = async (email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await mobileApiClient.post<any>("/api/v1/auth/login", { email, password: pass }, {
        skipAuth: true,
      });

      if (res && res.session) {
        const authToken = res.session.token;
        const profile: UserProfile = {
          id: res.user?.id || res.session.userId,
          email: res.user?.email || email,
          firstName: res.user?.firstName || "Manager",
          lastName: res.user?.lastName || "",
          phone: res.user?.phone,
          role: res.session.role || "MANAGER",
          permissions: res.session.permissions || [],
        };

        setToken(authToken);
        setUser(profile);
        mobileApiClient.setToken(authToken);

        await mobileStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
        await mobileStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));

        await refreshBranches();
        return true;
      }
      return false;
    } catch (err: any) {
      setError(sanitizeAuthError(err, "כתובת אימייל או סיסמה שגויים."));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const selectBranch = async (branch: ActiveBranch) => {
    setActiveBranch(branch);
    mobileApiClient.setBranchId(branch.id);
    await mobileStorage.setItem(STORAGE_KEYS.BRANCH, JSON.stringify(branch));
  };

  const logout = async () => {
    try {
      if (token) {
        await mobileApiClient.post("/api/v1/auth/logout", {}).catch(() => {});
      }
    } finally {
      setToken(null);
      setUser(null);
      setActiveBranch(null);
      setBranches([]);
      mobileApiClient.setToken("");
      mobileApiClient.setBranchId("");
      await mobileStorage.removeItem(STORAGE_KEYS.TOKEN);
      await mobileStorage.removeItem(STORAGE_KEYS.USER);
      await mobileStorage.removeItem(STORAGE_KEYS.BRANCH);
    }
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.role === "OWNER" || user.role === "ADMIN" || user.role === "MANAGER") return true;
    return user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        activeBranch,
        branches,
        isLoading,
        error,
        loginWithPin,
        loginWithPassword,
        selectBranch,
        refreshBranches,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
