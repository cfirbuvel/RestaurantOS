"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Lock, ShieldAlert, Delete, Check } from "lucide-react";

interface KDSAuthGuardProps {
  branchId: string;
  children: React.ReactNode;
}

export const KDSAuthGuard: React.FC<KDSAuthGuardProps> = ({ branchId, children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (res.ok) {
        const data = await res.json();
        const perms: string[] = data.session?.permissions || [];
        const role = data.session?.role;
        const hasAccess =
          perms.includes("kds.view") ||
          role === "OWNER" ||
          role === "ADMIN" ||
          role === "MANAGER" ||
          role === "KITCHEN_MANAGER" ||
          role === "KITCHEN_EMPLOYEE";

        if (hasAccess) {
          setIsAuthenticated(true);
          return;
        } else {
          setError("אין לך הרשאת גישה למסך המטבח (kds.view)");
          setIsAuthenticated(false);
          return;
        }
      }
      setIsAuthenticated(false);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handlePinSubmit = async (pinValue: string) => {
    if (pinValue.length < 4) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pinValue,
          branchId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "קוד PIN שגוי");
      }

      setPin("");
      await checkAuth();
    } catch (err: any) {
      setError(err.message || "הזיהוי נכשל");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 4 || nextPin.length === 6) {
      handlePinSubmit(nextPin);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <span className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold">מאמת הרשאות מערכת KDS...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Fast PIN Keypad Screen for Kitchen Staff
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-black text-slate-100 tracking-tight">
          כניסה למסך מטבח (KDS)
        </h1>
        <p className="text-xs text-slate-400 mt-1 mb-6 text-center">
          הקש קוד PIN של 4 עד 6 ספרות להתחברות מיידית
        </p>

        {/* PIN Indicators */}
        <div className="flex items-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                idx < pin.length
                  ? "bg-emerald-400 border-emerald-400 scale-110"
                  : "border-slate-700 bg-slate-800"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad: 64px min touch buttons */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleKeyPress(digit)}
              className="touch-target-kds h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-2xl font-black text-slate-100 border border-slate-700/60 transition-all flex items-center justify-center tabular-nums shadow"
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: Clear, 0, Backspace */}
          <button
            type="button"
            disabled={loading}
            onClick={() => setPin("")}
            className="touch-target-kds h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-xs font-black text-slate-400 border border-slate-800 transition-all flex items-center justify-center"
          >
            איפוס
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleKeyPress("0")}
            className="touch-target-kds h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-2xl font-black text-slate-100 border border-slate-700/60 transition-all flex items-center justify-center tabular-nums shadow"
          >
            0
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleDelete}
            className="touch-target-kds h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 font-bold">
            <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span>מאמת קוד PIN...</span>
          </div>
        )}
      </div>
    </div>
  );
};
