"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/public/CartContext";
import { useLanguage } from "@/components/public/LanguageContext";
import { ProductCard } from "@/components/public/ProductCard";
import { KioskUpsellModal } from "@/components/public/KioskComponents";
import {
  PublicCategoryDTO,
  RestaurantPublicInfo,
} from "@/modules/public-ordering/services/public-menu-service";

export default function KioskMenuPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = use(params);
  const router = useRouter();
  const { t, language, toggleLanguage } = useLanguage();
  const { cart, updateQuantity, removeItem, addItem } = useCart();

  const [categories, setCategories] = useState<PublicCategoryDTO[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantPublicInfo | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/public/${branchId}/menu`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setCategories(json.data.categories);
          setRestaurant(json.data.restaurant);
          if (json.data.categories.length > 0) {
            setSelectedCategoryId(json.data.categories[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  const activeCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0];

  const handleProceedToCheckout = () => {
    // Check if cart has burgers but no drinks/sides -> trigger deterministic upsell
    const hasBurger = cart.items.some(
      (it) => it.name.includes("בורגר") || it.name.includes("Burger")
    );
    const hasDrink = cart.items.some(
      (it) => it.name.includes("קולה") || it.name.includes("שתייה") || it.name.includes("Drink")
    );

    if (hasBurger && !hasDrink) {
      setShowUpsell(true);
    } else {
      router.push(`/kiosk/${branchId}/checkout`);
    }
  };

  const handleAcceptUpsell = () => {
    // Add combo drink + fries to cart
    addItem({
      productId: "prod-upsell-combo",
      name: "שדרוג לארוחה (צ'יפס + פחית)",
      basePrice: 18.0,
      quantity: 1,
    });
    setShowUpsell(false);
    router.push(`/kiosk/${branchId}/checkout`);
  };

  if (loading || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-amber-400">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-950 text-white">
      {/* Kiosk Top Bar */}
      <header className="h-20 bg-zinc-900 border-b border-zinc-800 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/kiosk/${branchId}`}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm border border-zinc-700 active:scale-95 transition-all"
          >
            ← {language === "he" ? "ביטול וחזרה להתחלה" : "Cancel & Return"}
          </Link>
          <div className="font-bold text-xl text-zinc-200">
            <span>{restaurant.name}</span>
            <span className="text-xs text-amber-400 mr-2 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              קיוסק הזמנה
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleLanguage}
          className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-bold text-sm text-zinc-200"
        >
          {language === "he" ? "🇬🇧 English" : "🇮🇱 עברית"}
        </button>
      </header>

      {/* Main Kiosk Body (Sidebar categories + Product grid + Cart bar) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Category Vertical Sidebar (240px) */}
        <aside className="w-64 bg-zinc-900/90 border-l border-zinc-800 p-4 space-y-3 overflow-y-auto">
          <span className="text-xs font-bold text-zinc-400 px-3 uppercase tracking-wider block">
            קטגוריות
          </span>
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`w-full p-4 rounded-2xl text-right font-black text-lg transition-all flex items-center justify-between ${
                  isSelected
                    ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-[1.02]"
                    : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-xs font-bold opacity-70">({cat.products.length})</span>
              </button>
            );
          })}
        </aside>

        {/* Product Grid (Center Area) */}
        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {activeCategory && (
            <div>
              <div className="pb-4 border-b border-zinc-800">
                <h2 className="text-3xl font-black text-white">{activeCategory.name}</h2>
                {activeCategory.description && (
                  <p className="text-base text-zinc-400 mt-1">{activeCategory.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-6">
                {activeCategory.products.map((prod) => (
                  <ProductCard key={prod.id} product={prod} isKiosk={true} />
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Persistent Cart Sidebar (360px) */}
        <aside className="w-96 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span>🛒</span>
                <span>{t("cart")}</span>
              </h3>
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-black">
                {cart.items.reduce((s, it) => s + it.quantity, 0)} פריטים
              </span>
            </div>

            {/* Cart Items List */}
            <div className="py-4 space-y-3 max-h-[calc(100vh-26rem)] overflow-y-auto">
              {cart.items.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 space-y-2">
                  <span className="text-5xl block">🍔</span>
                  <p className="font-bold text-base text-zinc-400">הסל שלך ריק</p>
                  <p className="text-xs text-zinc-500">גע במנה מהתפריט להוספה</p>
                </div>
              ) : (
                cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-zinc-850 border border-zinc-800 rounded-2xl p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-base text-zinc-100">{item.name}</h4>
                        {item.selectedModifiers.length > 0 && (
                          <p className="text-xs text-zinc-400">
                            {item.selectedModifiers.map((m) => m.name).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="font-black text-base text-amber-400">
                        ₪{item.itemTotal.toFixed(0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                      <div className="flex items-center bg-zinc-800 rounded-xl border border-zinc-700 p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center font-bold text-base"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center font-bold text-base"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-zinc-500 hover:text-red-400 text-xs font-semibold"
                      >
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart Footer */}
          {cart.items.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 space-y-4">
              <div className="flex justify-between items-baseline text-2xl font-black text-zinc-100">
                <span>{t("total")}</span>
                <span className="text-amber-400">₪{cart.totalAmount.toFixed(0)}</span>
              </div>

              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 font-black text-2xl shadow-xl shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-between px-6"
              >
                <span>{t("checkout")}</span>
                <span>₪{cart.totalAmount.toFixed(0)}</span>
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Upsell Modal */}
      <KioskUpsellModal
        isOpen={showUpsell}
        onAccept={handleAcceptUpsell}
        onSkip={() => {
          setShowUpsell(false);
          router.push(`/kiosk/${branchId}/checkout`);
        }}
      />
    </div>
  );
}
