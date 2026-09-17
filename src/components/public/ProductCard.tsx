"use client";

import React, { useState } from "react";
import { PublicProductDTO } from "@/modules/public-ordering/services/public-menu-service";
import { ModifierModal } from "./ModifierModal";
import { useCart } from "./CartContext";
import { useLanguage } from "./LanguageContext";

export function ProductCard({
  product,
  isKiosk = false,
}: {
  product: PublicProductDTO;
  isKiosk?: boolean;
}) {
  const { t } = useLanguage();
  const { addItem } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasModifiers =
    (product.modifierGroups && product.modifierGroups.length > 0) ||
    (product.variants && product.variants.length > 0);

  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  const handleDirectAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasModifiers) {
      setIsModalOpen(true);
    } else {
      addItem({
        productId: product.id,
        name: product.name,
        basePrice: product.basePrice,
        quantity: 1,
      });
    }
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`group bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:scale-[1.01] ${
          isKiosk ? "p-6 min-h-[260px]" : "min-h-[190px]"
        }`}
      >
        <div>
          {/* Top Row: Tags & Price */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex flex-wrap gap-1.5">
              {product.tags?.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-800 text-amber-300 border border-zinc-700"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="font-extrabold text-amber-400 text-lg sm:text-xl">
              ₪{product.basePrice.toFixed(0)}
            </div>
          </div>

          {/* Product Name */}
          <h3
            className={`font-bold text-zinc-100 group-hover:text-amber-400 transition-colors ${
              isKiosk ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
            }`}
          >
            {product.name}
          </h3>

          {/* Description */}
          {product.description && (
            <p
              className={`text-zinc-400 mt-1.5 line-clamp-2 ${
                isKiosk ? "text-base mt-2" : "text-xs sm:text-sm"
              }`}
            >
              {product.description}
            </p>
          )}
        </div>

        {/* Bottom CTA Row */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-medium">
            {hasModifiers ? (isKiosk ? "התאמה אישית" : "כולל בחירת תוספות") : ""}
          </span>
          <button
            type="button"
            onClick={handleDirectAdd}
            className={`flex items-center gap-1.5 bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 font-bold rounded-xl transition-all active:scale-95 shadow-sm ${
              isKiosk ? "px-5 py-3 text-base" : "px-3.5 py-1.5 text-xs sm:text-sm"
            }`}
          >
            <span>+</span>
            <span>{t("add_to_cart")}</span>
          </button>
        </div>
      </div>

      {/* Modifier Modal */}
      <ModifierModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddToCart={addItem}
        isKiosk={isKiosk}
      />
    </>
  );
}
