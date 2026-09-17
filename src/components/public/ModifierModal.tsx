"use client";

import React, { useState, useEffect } from "react";
import { PublicProductDTO, PublicModifierGroupDTO, PublicModifierDTO } from "@/modules/public-ordering/services/public-menu-service";
import { SelectedModifier } from "@/modules/public-ordering/domain/cart";
import { useLanguage } from "./LanguageContext";

interface ModifierModalProps {
  product: PublicProductDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: {
    productId: string;
    name: string;
    basePrice: number;
    quantity: number;
    variantId?: string | null;
    selectedModifiers: SelectedModifier[];
    notes?: string;
  }) => void;
  isKiosk?: boolean;
}

export function ModifierModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  isKiosk = false,
}: ModifierModalProps) {
  const { t, language } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, SelectedModifier>>(new Map());
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize defaults when modal opens
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setNotes("");
      setValidationError(null);

      // Default variant if exists
      if (product.variants && product.variants.length > 0) {
        setSelectedVariantId(product.variants[0].id);
      } else {
        setSelectedVariantId(null);
      }

      // Default required modifiers
      const initialMods = new Map<string, SelectedModifier>();
      for (const group of product.modifierGroups || []) {
        if (group.isRequired && group.modifiers && group.modifiers.length > 0) {
          const first = group.modifiers[0];
          initialMods.set(first.id, {
            modifierId: first.id,
            name: first.name,
            priceAdjustment: first.priceAdjustment,
          });
        }
      }
      setSelectedModifiers(initialMods);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleModifierToggle = (group: PublicModifierGroupDTO, mod: PublicModifierDTO) => {
    const next = new Map(selectedModifiers);

    if (group.maxSelection === 1) {
      // Single-choice (radio-like): remove other modifiers in this group
      for (const m of group.modifiers) {
        next.delete(m.id);
      }
      next.set(mod.id, {
        modifierId: mod.id,
        name: mod.name,
        priceAdjustment: mod.priceAdjustment,
      });
    } else {
      // Multi-choice (checkbox-like)
      if (next.has(mod.id)) {
        next.delete(mod.id);
      } else {
        // Count how many currently selected in this group
        const countInGroup = group.modifiers.filter((m) => next.has(m.id)).length;
        if (group.maxSelection && countInGroup >= group.maxSelection) {
          return; // Max reached
        }
        next.set(mod.id, {
          modifierId: mod.id,
          name: mod.name,
          priceAdjustment: mod.priceAdjustment,
        });
      }
    }
    setSelectedModifiers(next);
    setValidationError(null);
  };

  // Compute live price
  let basePrice = product.basePrice;
  if (selectedVariantId && product.variants) {
    const v = product.variants.find((v) => v.id === selectedVariantId);
    if (v) basePrice += v.priceAdjustment;
  }
  const modTotal = Array.from(selectedModifiers.values()).reduce((sum, m) => sum + (m.priceAdjustment ?? 0), 0);
  const singleUnitPrice = basePrice + modTotal;
  const totalPrice = singleUnitPrice * quantity;

  const handleConfirm = () => {
    // Validate required groups
    for (const group of product.modifierGroups || []) {
      const countInGroup = group.modifiers.filter((m) => selectedModifiers.has(m.id)).length;
      if (group.isRequired && countInGroup < group.minSelection) {
        setValidationError(
          language === "he"
            ? `יש לבחור לפחות ${group.minSelection} אפשרות מתוך '${group.name}'`
            : `Please select at least ${group.minSelection} from '${group.name}'`
        );
        return;
      }
    }

    onAddToCart({
      productId: product.id,
      name: product.name,
      basePrice,
      quantity,
      variantId: selectedVariantId,
      selectedModifiers: Array.from(selectedModifiers.values()),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden ${isKiosk ? "p-6 max-w-2xl text-lg" : "p-4 sm:p-6"}`}>
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-800">
          <div>
            <h2 className={`font-bold text-zinc-100 ${isKiosk ? "text-2xl" : "text-xl sm:text-2xl"}`}>
              {product.name}
            </h2>
            {product.description && (
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">{product.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Variants (if any) */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
                <span>גודל / סוג</span>
                <span className="text-xs text-amber-400">({t("required_selection")})</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-between transition-all ${
                      selectedVariantId === v.id
                        ? "bg-amber-500/10 border-amber-500 text-amber-300"
                        : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <span>{v.name}</span>
                    {v.priceAdjustment > 0 && <span>+₪{v.priceAdjustment}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modifier Groups */}
          {product.modifierGroups && product.modifierGroups.map((group) => {
            const countSelected = group.modifiers.filter((m) => selectedModifiers.has(m.id)).length;
            return (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-200">
                    {group.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                    group.isRequired
                      ? countSelected >= group.minSelection
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {group.isRequired ? t("required_selection") : t("optional_selection")}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.modifiers.map((mod) => {
                    const isSelected = selectedModifiers.has(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleModifierToggle(group, mod)}
                        className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-between transition-all active:scale-98 ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                            : "bg-zinc-800/50 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800"
                        } ${isKiosk ? "py-4 text-base" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-${group.maxSelection === 1 ? "full" : "md"} border flex items-center justify-center text-[10px] ${
                            isSelected ? "border-amber-400 bg-amber-400 text-zinc-950 font-bold" : "border-zinc-600"
                          }`}>
                            {isSelected ? (group.maxSelection === 1 ? "●" : "✓") : ""}
                          </span>
                          <span>{mod.name}</span>
                        </div>
                        {mod.priceAdjustment > 0 && (
                          <span className="text-xs text-zinc-400 font-bold">+₪{mod.priceAdjustment}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Instructions / Notes */}
          {!isKiosk && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-300 mb-1">
                {t("special_notes")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notes_placeholder")}
                rows={2}
                maxLength={200}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>

        {/* Validation Error Alert */}
        {validationError && (
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium mb-3">
            ⚠️ {validationError}
          </div>
        )}

        {/* Footer with Quantity & Add Button */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-4">
          {/* Quantity Controls */}
          <div className="flex items-center bg-zinc-800 rounded-xl border border-zinc-700 p-1">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600 flex items-center justify-center font-bold text-lg active:scale-95"
            >
              -
            </button>
            <span className="w-8 sm:w-10 text-center font-bold text-sm sm:text-base">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600 flex items-center justify-center font-bold text-lg active:scale-95"
            >
              +
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-2xl py-3 px-4 flex items-center justify-between shadow-lg shadow-amber-500/20 active:scale-98 transition-all ${
              isKiosk ? "py-4 text-xl" : "text-sm sm:text-base"
            }`}
          >
            <span>{t("add_to_cart")}</span>
            <span className="bg-zinc-950/20 px-2.5 py-1 rounded-xl font-extrabold">
              ₪{totalPrice.toFixed(0)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
