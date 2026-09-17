"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageContext";
import { useCart } from "./CartContext";
import { RestaurantPublicInfo } from "@/modules/public-ordering/services/public-menu-service";

export function PublicHeader({
  restaurant,
  slug,
  showNav = true,
}: {
  restaurant: RestaurantPublicInfo;
  slug: string;
  showNav?: boolean;
}) {
  const { t, language, toggleLanguage } = useLanguage();
  const { cart, setOrderType, totalItemsCount, toggleDrawer } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link href={`/r/${slug}`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            🍔
          </div>
          <div>
            <div className="font-bold text-base sm:text-lg text-zinc-100 group-hover:text-amber-400 transition-colors flex items-center gap-2">
              <span>{restaurant.name}</span>
              {restaurant.isOpenNow && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
                  {language === "he" ? "פתוח" : "Open"}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">{restaurant.tagline || restaurant.address.city}</p>
          </div>
        </Link>

        {showNav && (
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Order Type Selector */}
            <div className="bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 flex items-center text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setOrderType("DELIVERY")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  cart.orderType === "DELIVERY"
                    ? "bg-amber-500 text-zinc-950 shadow-md font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                🛵 {t("delivery")}
              </button>
              <button
                type="button"
                onClick={() => setOrderType("TAKEAWAY")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  cart.orderType === "TAKEAWAY"
                    ? "bg-amber-500 text-zinc-950 shadow-md font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                🛍️ {t("takeaway")}
              </button>
            </div>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              title="Switch Language / החלף שפה"
            >
              {language === "he" ? "EN" : "עב"}
            </button>

            {/* Cart Button */}
            <button
              type="button"
              onClick={toggleDrawer}
              className="relative flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <span className="text-base">🛒</span>
              <span className="hidden sm:inline">{t("cart")}</span>
              {totalItemsCount > 0 && (
                <span className="bg-zinc-950 text-amber-400 text-xs px-2 py-0.5 rounded-full font-extrabold border border-amber-400/40">
                  {totalItemsCount}
                </span>
              )}
              {cart.subtotal > 0 && (
                <span className="text-zinc-950 font-extrabold border-l border-zinc-900/30 pl-2 pr-1 hidden md:inline">
                  ₪{cart.totalAmount.toFixed(0)}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
