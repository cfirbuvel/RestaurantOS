"use client";

import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/public/CartContext";
import { useLanguage } from "@/components/public/LanguageContext";
import { KioskEmvTerminalModal } from "@/components/public/KioskComponents";

export default function KioskCheckoutPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = use(params);
  const router = useRouter();
  const { t, language } = useLanguage();
  const { cart, setOrderType, clearCart } = useCart();

  const [customerName, setCustomerName] = useState("אורח קיוסק");
  const [customerPhone, setCustomerPhone] = useState("050-0000000");
  const [tableNumber, setTableNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"EMV_TERMINAL" | "PAY_AT_COUNTER">(
    "EMV_TERMINAL"
  );
  const [showEmvModal, setShowEmvModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeOrderSubmission = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        items: cart.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          basePrice: it.basePrice,
          quantity: it.quantity,
          variantId: it.variantId || null,
          selectedModifiers: it.selectedModifiers,
          notes: it.notes,
        })),
        orderType: cart.orderType === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
        channel: "KIOSK",
        customer: {
          name: customerName,
          phone: customerPhone,
        },
        paymentMethod,
        paymentDetails:
          paymentMethod === "EMV_TERMINAL"
            ? {
                gateway: "MOCK",
                emvAuthCode: `AUTH_${Date.now().toString().slice(-6)}`,
              }
            : undefined,
        tableNumber: tableNumber ? tableNumber : undefined,
      };

      const res = await fetch(`/api/v1/public/${branchId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "שגיאה בביצוע ההזמנה בקיוסק");
      }

      router.push(`/kiosk/${branchId}/confirm?orderNumber=${json.data.orderNumber}`);
    } catch (err: any) {
      setError(err.message || "שגיאה בתקשורת עם השרת");
      setLoading(false);
      setShowEmvModal(false);
    }
  };

  const handleStartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "EMV_TERMINAL") {
      setShowEmvModal(true);
    } else {
      executeOrderSubmission();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 sm:p-12 flex flex-col justify-between select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <Link
            href={`/kiosk/${branchId}/menu`}
            className="px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-base border border-zinc-700 active:scale-95 transition-all"
          >
            ← חזרה לתפריט
          </Link>
          <h1 className="text-3xl font-black">סיום והזמנה בקיוסק</h1>
        </div>

        <div className="text-2xl font-black text-amber-400">
          סה״כ: ₪{cart.totalAmount.toFixed(0)}
        </div>
      </div>

      {/* Main Options Grid */}
      <form onSubmit={handleStartPayment} className="max-w-4xl mx-auto w-full my-8 space-y-8">
        {/* Order Type Large Buttons */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-300">איפה תרצה לאכול?</h2>
          <div className="grid grid-cols-2 gap-6">
            <button
              type="button"
              onClick={() => setOrderType("DINE_IN")}
              className={`p-8 rounded-3xl border-2 text-center transition-all ${
                cart.orderType === "DINE_IN"
                  ? "bg-amber-500/20 border-amber-500 text-white shadow-xl scale-[1.02]"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className="text-6xl block mb-3">🍽️</span>
              <span className="text-2xl font-black block">ישיבה במסעדה</span>
              <span className="text-xs text-zinc-400 mt-1 block">נגיש לך במגש למקום</span>
            </button>

            <button
              type="button"
              onClick={() => setOrderType("TAKEAWAY")}
              className={`p-8 rounded-3xl border-2 text-center transition-all ${
                cart.orderType === "TAKEAWAY"
                  ? "bg-amber-500/20 border-amber-500 text-white shadow-xl scale-[1.02]"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className="text-6xl block mb-3">🛍️</span>
              <span className="text-2xl font-black block">איסוף לקחת (Takeaway)</span>
              <span className="text-xs text-zinc-400 mt-1 block">ארוז ומוכן בשקית</span>
            </button>
          </div>
        </div>

        {/* Payment Method Large Selection */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-300">אופן תשלום</h2>
          <div className="grid grid-cols-2 gap-6">
            <button
              type="button"
              onClick={() => setPaymentMethod("EMV_TERMINAL")}
              className={`p-8 rounded-3xl border-2 text-center transition-all ${
                paymentMethod === "EMV_TERMINAL"
                  ? "bg-amber-500/20 border-amber-500 text-white shadow-xl scale-[1.02]"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className="text-6xl block mb-3">💳</span>
              <span className="text-2xl font-black block">תשלום במסוף אשראי</span>
              <span className="text-xs text-amber-400 mt-1 block">הצמדה מהירה / Apple Pay / Google Pay</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("PAY_AT_COUNTER")}
              className={`p-8 rounded-3xl border-2 text-center transition-all ${
                paymentMethod === "PAY_AT_COUNTER"
                  ? "bg-amber-500/20 border-amber-500 text-white shadow-xl scale-[1.02]"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className="text-6xl block mb-3">🏪</span>
              <span className="text-2xl font-black block">תשלום בדלפק</span>
              <span className="text-xs text-zinc-400 mt-1 block">מזומן או שובר בקופה</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-2xl text-red-300 text-center font-bold">
            ⚠️ {error}
          </div>
        )}

        {/* Submit / Pay CTA Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-6 rounded-3xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 text-zinc-950 font-black text-2xl sm:text-3xl shadow-2xl shadow-amber-500/30 active:scale-98 transition-all flex items-center justify-between px-8"
        >
          <span>{paymentMethod === "EMV_TERMINAL" ? "המשך לתשלום במסוף" : "שליחת הזמנה לדלפק"}</span>
          <span className="bg-zinc-950/20 px-4 py-2 rounded-2xl">₪{cart.totalAmount.toFixed(0)}</span>
        </button>
      </form>

      {/* Mock EMV Terminal Modal */}
      <KioskEmvTerminalModal
        isOpen={showEmvModal}
        totalAmount={cart.totalAmount}
        onComplete={executeOrderSubmission}
      />
    </div>
  );
}
