"use client";

import React, { useState } from "react";
import { useCart } from "./CartContext";
import { useLanguage } from "./LanguageContext";

export function CouponInput() {
  const { t } = useLanguage();
  const { cart, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await applyCoupon(code);
      setMessage({ text: res.message, isError: !res.success });
      if (res.success) {
        setCode("");
      }
    } finally {
      setLoading(false);
    }
  };

  if (cart.couponCode) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-sm">🏷️ {cart.couponCode}</span>
          <span className="text-xs text-emerald-300">(-₪{cart.discountAmount.toFixed(0)})</span>
        </div>
        <button
          type="button"
          onClick={removeCoupon}
          className="text-zinc-400 hover:text-red-400 text-xs font-bold px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          ✕ {t("remove")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleApply} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("coupon_code")}
          className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 uppercase font-mono"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl border border-zinc-700 transition-colors"
        >
          {loading ? "..." : t("apply_coupon")}
        </button>
      </form>
      {message && (
        <p className={`text-xs font-medium ${message.isError ? "text-red-400" : "text-emerald-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
