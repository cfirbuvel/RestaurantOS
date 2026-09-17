"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { useLanguage } from "./LanguageContext";
import { CouponInput } from "./CouponInput";

export function CartSummary({
  slug,
  isSidebar = false,
  isCheckoutPage = false,
}: {
  slug: string;
  isSidebar?: boolean;
  isCheckoutPage?: boolean;
}) {
  const { t, language } = useLanguage();
  const { cart, isDrawerOpen, closeDrawer, updateQuantity, removeItem, setTipAmount } = useCart();

  const tips = [0, 5, 10, 15, 20];

  const content = (
    <div className="flex flex-col h-full bg-zinc-900 text-zinc-100 p-4 sm:p-6 rounded-3xl border border-zinc-800 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <span>🛒</span>
          <span>{t("cart")}</span>
          {cart.items.length > 0 && (
            <span className="text-xs bg-zinc-800 text-amber-400 px-2 py-0.5 rounded-full font-bold">
              {cart.items.reduce((s, it) => s + it.quantity, 0)}
            </span>
          )}
        </h2>
        {!isSidebar && !isCheckoutPage && (
          <button
            type="button"
            onClick={closeDrawer}
            className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {cart.items.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 space-y-2">
            <span className="text-4xl block">🍔</span>
            <p className="font-medium text-sm text-zinc-400">{t("empty_cart")}</p>
            <p className="text-xs text-zinc-500">{t("empty_cart_cta")}</p>
          </div>
        ) : (
          cart.items.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-850/70 border border-zinc-800/80 rounded-2xl p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-zinc-100">{item.name}</h4>
                  {item.selectedModifiers.length > 0 && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {item.selectedModifiers.map((m) => m.name).join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-[11px] text-amber-400/80 italic mt-0.5">"{item.notes}"</p>
                  )}
                </div>
                <span className="font-bold text-sm text-amber-400 whitespace-nowrap">
                  ₪{item.itemTotal.toFixed(0)}
                </span>
              </div>

              {/* Quantity Controls & Delete */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40 text-xs">
                <div className="flex items-center bg-zinc-800 rounded-lg border border-zinc-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="w-7 text-center font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  {t("remove")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Footer */}
      {cart.items.length > 0 && (
        <div className="pt-4 border-t border-zinc-800 space-y-4">
          {/* Coupon Input */}
          <CouponInput />

          {/* Tip Selector (if delivery) */}
          {cart.orderType === "DELIVERY" && !isCheckoutPage && (
            <div>
              <span className="block text-xs font-semibold text-zinc-400 mb-1.5">{t("tip")}</span>
              <div className="flex gap-1.5">
                {tips.map((tip) => (
                  <button
                    key={tip}
                    type="button"
                    onClick={() => setTipAmount(tip)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                      cart.tipAmount === tip
                        ? "bg-amber-500 text-zinc-950 shadow-sm"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tip === 0 ? "0" : `₪${tip}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Totals Breakdown */}
          <div className="space-y-1.5 text-xs sm:text-sm text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-400">{t("subtotal")}</span>
              <span>₪{cart.subtotal.toFixed(0)}</span>
            </div>

            {cart.orderType === "DELIVERY" && (
              <div className="flex justify-between">
                <span className="text-zinc-400">{t("delivery_fee")}</span>
                <span>₪{cart.deliveryFee.toFixed(0)}</span>
              </div>
            )}

            {cart.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400 font-medium">
                <span>{t("discount")}</span>
                <span>-₪{cart.discountAmount.toFixed(0)}</span>
              </div>
            )}

            {cart.tipAmount > 0 && (
              <div className="flex justify-between text-amber-300 font-medium">
                <span>{t("tip")}</span>
                <span>₪{cart.tipAmount.toFixed(0)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline font-extrabold text-base sm:text-lg text-zinc-100">
              <span>{t("total")}</span>
              <span className="text-amber-400">₪{cart.totalAmount.toFixed(0)}</span>
            </div>

            <p className="text-[10px] text-zinc-500 text-center">{t("includes_vat")}</p>
          </div>

          {/* Checkout Action Button */}
          {!isCheckoutPage && (
            <Link
              href={`/r/${slug}/checkout`}
              onClick={closeDrawer}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-extrabold rounded-2xl py-3.5 px-4 flex items-center justify-between shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
            >
              <span>{t("checkout")}</span>
              <span>₪{cart.totalAmount.toFixed(0)}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );

  // If sidebar mode or on checkout page, render plain container
  if (isSidebar || isCheckoutPage) {
    return <aside className="w-full h-full">{content}</aside>;
  }

  // Drawer overlay for mobile / top-right slide
  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-0" onClick={closeDrawer} />
      <div
        className={`absolute top-0 bottom-0 ${
          language === "he" ? "left-0" : "right-0"
        } w-full max-w-md p-4 sm:p-6 animate-slideIn flex flex-col`}
      >
        {content}
      </div>
    </div>
  );
}
