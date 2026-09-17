"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageContext";
import { useCart } from "./CartContext";
import { RestaurantPublicInfo } from "@/modules/public-ordering/services/public-menu-service";

/**
 * 1. Kiosk Fullscreen Attract Screen
 */
export function KioskAttractScreen({
  restaurant,
  branchId,
}: {
  restaurant: RestaurantPublicInfo;
  branchId: string;
}) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white flex flex-col justify-between overflow-hidden select-none cursor-pointer">
      {/* Background Decorative Gradient Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-600/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Bar: Brand & Language Toggle */}
      <div className="relative z-10 p-8 sm:p-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/20">
            🍔
          </div>
          <div>
            <h1 className="text-3xl font-black text-zinc-100">{restaurant.name}</h1>
            <p className="text-sm text-zinc-400 font-medium">עמדת הזמנה עצמית • Self-Service Kiosk</p>
          </div>
        </div>

        {/* Large Touch Language Switcher */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLanguage("he");
            }}
            className={`px-6 py-3.5 rounded-2xl font-black text-lg border-2 transition-all ${
              language === "he"
                ? "bg-amber-500 border-amber-400 text-zinc-950 shadow-lg shadow-amber-500/30 scale-105"
                : "bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            🇮🇱 עברית
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLanguage("en");
            }}
            className={`px-6 py-3.5 rounded-2xl font-black text-lg border-2 transition-all ${
              language === "en"
                ? "bg-amber-500 border-amber-400 text-zinc-950 shadow-lg shadow-amber-500/30 scale-105"
                : "bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* Center Hero: Pulsing Start Button */}
      <div className="relative z-10 my-auto text-center px-6 flex flex-col items-center">
        <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-amber-500/30 to-orange-600/30 border border-amber-500/40 flex items-center justify-center p-4 animate-pulse">
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-6xl shadow-2xl shadow-amber-500/40">
            🍔
          </div>
        </div>

        <h2 className="text-4xl sm:text-6xl font-black text-white mt-8 tracking-tight">
          {t("kiosk_welcome")}
        </h2>
        <p className="text-lg sm:text-2xl text-zinc-300 mt-3 font-medium max-w-xl">
          {restaurant.tagline || "המבורגרים טריים, תוספות חמות ושתייה מרעננת"}
        </p>

        <Link
          href={`/kiosk/${branchId}/menu`}
          className="mt-10 px-12 py-6 rounded-3xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-2xl sm:text-3xl shadow-2xl shadow-amber-500/40 ring-4 ring-amber-500/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
        >
          <span>👉</span>
          <span>{t("kiosk_touch_start")}</span>
        </Link>
      </div>

      {/* Bottom Info Banner */}
      <div className="relative z-10 p-8 text-center border-t border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md text-xs sm:text-sm text-zinc-400 flex justify-between items-center max-w-7xl mx-auto w-full">
        <span>📍 {restaurant.address.street} {restaurant.address.houseNumber}, {restaurant.address.city}</span>
        <span className="font-semibold text-zinc-300">תשלום מאובטח באשראי / EMV Contactless • מזומן בדלפק</span>
        <span>⏱️ זמן הכנה משוער: 12-15 דקות</span>
      </div>
    </div>
  );
}

/**
 * 2. Kiosk Inactivity Session Guard (Auto Reset Timer)
 */
export function KioskSessionGuard({
  branchId,
  timeoutSeconds = 120,
  warningSeconds = 20,
  children,
}: {
  branchId: string;
  timeoutSeconds?: number;
  warningSeconds?: number;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const { clearCart } = useCart();
  const [secondsRemaining, setSecondsRemaining] = useState(timeoutSeconds);
  const [showWarning, setShowWarning] = useState(false);

  const resetTimer = useCallback(() => {
    setSecondsRemaining(timeoutSeconds);
    setShowWarning(false);
  }, [timeoutSeconds]);

  useEffect(() => {
    const handleActivity = () => {
      if (!showWarning) {
        setSecondsRemaining(timeoutSeconds);
      }
    };

    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Timeout reached: clear cart and redirect to attract screen
          clearCart();
          window.location.href = `/kiosk/${branchId}`;
          return 0;
        }
        if (prev <= warningSeconds) {
          setShowWarning(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(interval);
    };
  }, [branchId, clearCart, timeoutSeconds, warningSeconds, showWarning]);

  return (
    <>
      {children}

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 select-none animate-fadeIn">
          <div className="bg-zinc-900 border-2 border-amber-500 rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl">
            <div className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-4xl mx-auto text-amber-400 font-black animate-pulse">
              {secondsRemaining}
            </div>

            <h3 className="text-3xl font-black text-white">{t("are_you_still_there")}</h3>
            <p className="text-zinc-300 text-base">
              {t("kiosk_auto_reset")} {secondsRemaining} {t("seconds")}
            </p>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={resetTimer}
                className="flex-1 py-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xl shadow-lg active:scale-95 transition-all"
              >
                {t("continue_order")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearCart();
                  window.location.href = `/kiosk/${branchId}`;
                }}
                className="px-6 py-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-base border border-zinc-700 active:scale-95 transition-all"
              >
                {t("reset_order")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 3. Kiosk Deterministic Rule-Based Upsell Prompt
 */
export function KioskUpsellModal({
  isOpen,
  onAccept,
  onSkip,
}: {
  isOpen: boolean;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-xl w-full text-center space-y-6 shadow-2xl">
        <div className="text-6xl mb-2">🍟🥤</div>
        <h3 className="text-3xl font-black text-white">{t("kiosk_upsell_title")}</h3>
        <p className="text-lg text-zinc-300">{t("kiosk_upsell_desc")}</p>

        <div className="pt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 font-black text-xl shadow-xl shadow-amber-500/30 active:scale-95 transition-all"
          >
            {t("kiosk_upsell_accept")}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold text-base active:scale-95 transition-all"
          >
            {t("kiosk_upsell_skip")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 4. Kiosk Mock EMV Card Terminal Handshake Screen
 */
export function KioskEmvTerminalModal({
  isOpen,
  totalAmount,
  onComplete,
}: {
  isOpen: boolean;
  totalAmount: number;
  onComplete: () => void;
}) {
  const { t } = useLanguage();
  const [step, setStep] = useState<"WAITING_TAP" | "PROCESSING" | "APPROVED">("WAITING_TAP");

  useEffect(() => {
    if (isOpen) {
      setStep("WAITING_TAP");
      // Simulate customer tapping card after 2.5 seconds
      const tapTimer = setTimeout(() => {
        setStep("PROCESSING");
        // Simulate authorization after 1.5 seconds
        const authTimer = setTimeout(() => {
          setStep("APPROVED");
          // Complete payment after 1 second
          const doneTimer = setTimeout(() => {
            onComplete();
          }, 1200);
          return () => clearTimeout(doneTimer);
        }, 1500);
        return () => clearTimeout(authTimer);
      }, 2500);

      return () => clearTimeout(tapTimer);
    }
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-3xl p-10 max-w-lg w-full text-center space-y-6 shadow-2xl text-white">
        {step === "WAITING_TAP" && (
          <>
            <div className="w-28 h-28 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-5xl mx-auto animate-pulse">
              💳
            </div>
            <h3 className="text-2xl sm:text-3xl font-black">{t("kiosk_terminal_prompt")}</h3>
            <div className="text-3xl font-black text-amber-400">₪{totalAmount.toFixed(0)}</div>
            <p className="text-xs text-zinc-400">תומך ב-Apple Pay, Google Pay, כרטיסי אשראי ו-EMV Contactless</p>
          </>
        )}

        {step === "PROCESSING" && (
          <>
            <div className="w-24 h-24 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <h3 className="text-2xl font-bold">מבצע אישור עסקה מול מסוף האשראי...</h3>
            <p className="text-xs text-zinc-400">אנא אל תוציא את הכרטיס</p>
          </>
        )}

        {step === "APPROVED" && (
          <>
            <div className="w-28 h-28 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-5xl mx-auto text-emerald-400 animate-bounce">
              ✓
            </div>
            <h3 className="text-3xl font-black text-emerald-400">העסקה אושרה בהצלחה!</h3>
            <p className="text-sm text-zinc-300">מדפיס קבלה ומעביר להזמנה...</p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 5. Kiosk Order Confirmation Callout Screen
 */
export function KioskConfirmScreen({
  orderNumber,
  branchId,
}: {
  orderNumber: string;
  branchId: string;
}) {
  const { t } = useLanguage();
  const { clearCart } = useCart();
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    clearCart();
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = `/kiosk/${branchId}`;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [branchId, clearCart]);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col justify-between p-8 sm:p-16 text-center select-none">
      <div className="pt-8">
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 text-5xl flex items-center justify-center mx-auto mb-6">
          🎉
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white">{t("order_confirmed")}</h1>
        <p className="text-xl text-zinc-400 mt-2">ההזמנה נשלחה למסך המטבח (KDS)</p>
      </div>

      {/* Large Callout Number */}
      <div className="my-auto py-8">
        <span className="text-xl sm:text-2xl text-zinc-400 block font-semibold">
          {t("kiosk_order_callout")}
        </span>
        <div className="text-7xl sm:text-9xl font-black text-amber-400 tracking-wider my-4 font-mono">
          #{orderNumber}
        </div>
        <p className="text-lg text-zinc-300">
          אנא עקוב אחר מספר הקריאה במסכי התצוגה מעל הדלפק
        </p>
      </div>

      {/* Bottom auto-reset countdown */}
      <div className="pb-8">
        <p className="text-sm text-zinc-500">
          {t("kiosk_auto_reset")} {countdown} {t("seconds")}
        </p>
        <Link
          href={`/kiosk/${branchId}`}
          className="mt-4 inline-block px-8 py-3 rounded-2xl bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold hover:bg-zinc-800 transition-colors"
        >
          חזור להתחלה עכשיו
        </Link>
      </div>
    </div>
  );
}
