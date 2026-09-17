"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "./LanguageContext";

interface OrderStatusData {
  orderId: string;
  orderNumber: string;
  status: string;
  channel: string;
  orderType: string;
  createdAt: string;
  estimatedMinutes: number;
  itemsCount: number;
  totalAmount: number;
  deliveryAddress?: any;
  driverLocation?: {
    lat: number;
    lng: number;
    heading: number;
    speedKmh: number;
    driverName: string;
    driverPhone: string;
  } | null;
}

const statusSteps = [
  { key: "PENDING", labelHe: "התקבלה", labelEn: "Received", icon: "📝" },
  { key: "PREPARING", labelHe: "בהכנה במטבח", labelEn: "Preparing", icon: "👨‍🍳" },
  { key: "READY", labelHe: "מוכנה", labelEn: "Ready", icon: "📦" },
  { key: "IN_TRANSIT", labelHe: "השליח בדרך", labelEn: "On the way", icon: "🛵" },
  { key: "COMPLETED", labelHe: "נמסרה", labelEn: "Delivered", icon: "🎉" },
];

export function OrderStatusTracker({
  slug,
  orderId,
  initialData,
  token,
}: {
  slug: string;
  orderId: string;
  initialData?: OrderStatusData | null;
  token?: string;
}) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<OrderStatusData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const query = token ? `?token=${token}` : "";
        const res = await fetch(`/api/v1/public/${slug}/order-status/${orderId}${query}`);
        if (!res.ok) throw new Error("Order not found");
        const json = await res.json();
        if (isMounted && json.success) {
          setData(json.data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    // Poll every 5s for real-time progress
    const interval = setInterval(fetchStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [slug, orderId, token]);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center text-zinc-400">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-semibold">{t("processing_order")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center text-red-400">
        <span className="text-4xl block mb-2">⚠️</span>
        <p className="font-bold">לא ניתן לאתר את נתוני ההזמנה</p>
      </div>
    );
  }

  // Calculate current active step index
  const normalizedStatus = data.status === "CONFIRMED" ? "PREPARING" : data.status;
  const currentStepIdx = statusSteps.findIndex((s) => s.key === normalizedStatus);
  const activeIdx = currentStepIdx >= 0 ? currentStepIdx : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-850 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1"></span>
                {t("order_number")} #{data.orderNumber}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {data.channel} • {data.orderType}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              {language === "he" ? statusSteps[activeIdx].labelHe : statusSteps[activeIdx].labelEn}
            </h1>
          </div>

          <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-4 text-center sm:text-left min-w-[140px]">
            <span className="text-xs text-zinc-400 block font-medium">{t("estimated_time")}</span>
            <span className="text-2xl font-black text-amber-400">
              ~{data.estimatedMinutes} {t("minutes")}
            </span>
          </div>
        </div>

        {/* Step Progression Bar */}
        <div className="pt-6">
          <div className="grid grid-cols-5 gap-2 relative">
            {statusSteps.map((step, idx) => {
              const isPast = idx < activeIdx;
              const isCurrent = idx === activeIdx;

              return (
                <div key={step.key} className="flex flex-col items-center text-center relative z-10">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-base sm:text-xl font-bold transition-all ${
                      isCurrent
                        ? "bg-amber-500 text-zinc-950 ring-4 ring-amber-500/30 shadow-lg shadow-amber-500/30 scale-110"
                        : isPast
                        ? "bg-emerald-500 text-zinc-950 font-bold"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                    }`}
                  >
                    {isPast ? "✓" : step.icon}
                  </div>
                  <span
                    className={`mt-2 text-[10px] sm:text-xs font-semibold leading-tight ${
                      isCurrent
                        ? "text-amber-400 font-extrabold"
                        : isPast
                        ? "text-zinc-200"
                        : "text-zinc-500"
                    }`}
                  >
                    {language === "he" ? step.labelHe : step.labelEn}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live GPS Telemetry for Delivery */}
      {data.orderType === "DELIVERY" && data.driverLocation && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="text-xl">📍</span>
              <span>{t("live_tracking")}</span>
            </h3>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live GPS • {data.driverLocation.speedKmh} km/h
            </span>
          </div>

          {/* Interactive Simulated Map Canvas */}
          <div className="relative h-48 sm:h-64 rounded-2xl bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-850 border border-zinc-800 overflow-hidden flex items-center justify-center p-4">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />

            {/* Simulated Route Line */}
            <div className="absolute w-2/3 h-1 bg-gradient-to-r from-amber-500/40 via-amber-400 to-emerald-500 rounded-full blur-[1px]" />

            {/* Restaurant Pin */}
            <div className="absolute left-[20%] top-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm text-white shadow-lg">
                🍔
              </div>
              <span className="text-[10px] text-zinc-400 font-bold mt-1 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                מסעדה
              </span>
            </div>

            {/* Moving Courier Marker */}
            <div className="absolute left-[55%] top-1/2 -translate-y-1/2 flex flex-col items-center animate-bounce duration-1000">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-lg text-zinc-950 font-black shadow-xl ring-4 ring-amber-400/40">
                🛵
              </div>
              <span className="text-[10px] text-amber-300 font-bold mt-1 bg-zinc-900/90 px-2 py-0.5 rounded border border-amber-500/40 whitespace-nowrap">
                {data.driverLocation.driverName}
              </span>
            </div>

            {/* Customer Pin */}
            <div className="absolute right-[15%] top-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm text-white shadow-lg">
                🏠
              </div>
              <span className="text-[10px] text-zinc-400 font-bold mt-1 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                יעד
              </span>
            </div>
          </div>

          {/* Courier Details Card */}
          <div className="bg-zinc-850/70 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-xl">
                👤
              </div>
              <div>
                <p className="font-bold text-sm text-zinc-200">{data.driverLocation.driverName}</p>
                <p className="text-xs text-zinc-400">שליח פעיל בצוות</p>
              </div>
            </div>
            <a
              href={`tel:${data.driverLocation.driverPhone}`}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3.5 py-2 rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              <span>📞</span>
              <span>התקשר לשליח</span>
            </a>
          </div>
        </div>
      )}

      {/* Order Info & Address Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-zinc-300 space-y-4">
        <h3 className="font-bold text-base text-zinc-100">פרטי ההזמנה</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div>
            <span className="text-zinc-500 block">סוג הזמנה</span>
            <span className="font-semibold text-zinc-200">{data.orderType}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">סה״כ לתשלום</span>
            <span className="font-semibold text-amber-400">₪{data.totalAmount.toFixed(0)}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">כמות פריטים</span>
            <span className="font-semibold text-zinc-200">{data.itemsCount}</span>
          </div>
        </div>

        {data.deliveryAddress && (
          <div className="pt-3 border-t border-zinc-800 text-xs">
            <span className="text-zinc-500 block">כתובת למשלוח:</span>
            <p className="text-zinc-200 font-medium mt-0.5">
              {data.deliveryAddress.street} {data.deliveryAddress.houseNumber}, {data.deliveryAddress.city}
              {data.deliveryAddress.apartment && `, דירה ${data.deliveryAddress.apartment}`}
              {data.deliveryAddress.floor && `, קומה ${data.deliveryAddress.floor}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
