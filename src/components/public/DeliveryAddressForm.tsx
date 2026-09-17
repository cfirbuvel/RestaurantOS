"use client";

import React from "react";
import { useLanguage } from "./LanguageContext";

export interface AddressFormData {
  city: string;
  street: string;
  houseNumber: string;
  floor?: string;
  apartment?: string;
  entrance?: string;
  gateCode?: string;
  notes?: string;
}

export function DeliveryAddressForm({
  value,
  onChange,
  errors = {},
}: {
  value: AddressFormData;
  onChange: (val: AddressFormData) => void;
  errors?: Record<string, string>;
}) {
  const { t } = useLanguage();

  const handleChange = (field: keyof AddressFormData, val: string) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            {t("city")} <span className="text-amber-400">*</span>
          </label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => handleChange("city", e.target.value)}
            placeholder="לדוגמה: תל אביב"
            className={`w-full bg-zinc-800/80 border ${
              errors.city ? "border-red-500" : "border-zinc-700"
            } rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500`}
          />
          {errors.city && <p className="text-xs text-red-400 mt-1">{errors.city}</p>}
        </div>

        {/* Street */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            {t("street")} <span className="text-amber-400">*</span>
          </label>
          <input
            type="text"
            value={value.street}
            onChange={(e) => handleChange("street", e.target.value)}
            placeholder="לדוגמה: רוטשילד"
            className={`w-full bg-zinc-800/80 border ${
              errors.street ? "border-red-500" : "border-zinc-700"
            } rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500`}
          />
          {errors.street && <p className="text-xs text-red-400 mt-1">{errors.street}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* House # */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            {t("house_number")} <span className="text-amber-400">*</span>
          </label>
          <input
            type="text"
            value={value.houseNumber}
            onChange={(e) => handleChange("houseNumber", e.target.value)}
            placeholder="45"
            className={`w-full bg-zinc-800/80 border ${
              errors.houseNumber ? "border-red-500" : "border-zinc-700"
            } rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500`}
          />
          {errors.houseNumber && <p className="text-xs text-red-400 mt-1">{errors.houseNumber}</p>}
        </div>

        {/* Floor */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">{t("floor")}</label>
          <input
            type="text"
            value={value.floor || ""}
            onChange={(e) => handleChange("floor", e.target.value)}
            placeholder="3"
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Apartment */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">{t("apartment")}</label>
          <input
            type="text"
            value={value.apartment || ""}
            onChange={(e) => handleChange("apartment", e.target.value)}
            placeholder="12"
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Entrance */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">{t("entrance")}</label>
          <input
            type="text"
            value={value.entrance || ""}
            onChange={(e) => handleChange("entrance", e.target.value)}
            placeholder="ב"
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gate Code */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">{t("gate_code")}</label>
          <input
            type="text"
            value={value.gateCode || ""}
            onChange={(e) => handleChange("gateCode", e.target.value)}
            placeholder="#1357"
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Notes for Courier */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">{t("delivery_notes")}</label>
          <input
            type="text"
            value={value.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="להשאיר ליד הדלת, לא לצלצל"
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>
    </div>
  );
}
