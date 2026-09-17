"use client";

import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/public/CartContext";
import { useLanguage } from "@/components/public/LanguageContext";
import { DeliveryAddressForm, AddressFormData } from "@/components/public/DeliveryAddressForm";
import { CartSummary } from "@/components/public/CartSummary";

export default function PublicCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { t, language } = useLanguage();
  const { cart, setOrderType, clearCart } = useCart();

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const [deliveryAddress, setDeliveryAddress] = useState<AddressFormData>({
    city: "תל אביב",
    street: "",
    houseNumber: "",
    floor: "",
    apartment: "",
    entrance: "",
    gateCode: "",
    notes: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<"CREDIT_CARD" | "CASH" | "PAY_AT_COUNTER">(
    "CREDIT_CARD"
  );
  const [gateway, setGateway] = useState<"MESHULAM" | "STRIPE">("MESHULAM");
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!customer.name.trim() || customer.name.trim().length < 2) {
      errors.name = "יש להזין שם מלא (לפחות 2 תווים)";
    }
    if (!customer.phone.trim() || customer.phone.trim().length < 9) {
      errors.phone = "יש להזין מספר טלפון תקין";
    }

    if (cart.orderType === "DELIVERY") {
      if (!deliveryAddress.city.trim()) {
        errors.city = "יש להזין עיר";
      }
      if (!deliveryAddress.street.trim()) {
        errors.street = "יש להזין רחוב";
      }
      if (!deliveryAddress.houseNumber.trim()) {
        errors.houseNumber = "יש להזין מספר בית";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    if (cart.items.length === 0) {
      setSubmissionError("סל ההזמנות ריק. אנא הוסף פריטים מהתפריט.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

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
        orderType: cart.orderType,
        channel: "WEB",
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim() || undefined,
        },
        deliveryAddress:
          cart.orderType === "DELIVERY"
            ? {
                city: deliveryAddress.city.trim(),
                street: deliveryAddress.street.trim(),
                houseNumber: deliveryAddress.houseNumber.trim(),
                floor: deliveryAddress.floor || undefined,
                apartment: deliveryAddress.apartment || undefined,
                entrance: deliveryAddress.entrance || undefined,
                gateCode: deliveryAddress.gateCode || undefined,
                notes: deliveryAddress.notes || undefined,
              }
            : undefined,
        paymentMethod,
        paymentDetails:
          paymentMethod === "CREDIT_CARD"
            ? {
                gateway,
                token: "mock_tok_public_card",
              }
            : undefined,
        couponCode: cart.couponCode || undefined,
        tipAmount: cart.tipAmount || 0,
      };

      const res = await fetch(`/api/v1/public/${slug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || "שגיאה בביצוע ההזמנה");
      }

      clearCart();
      router.push(json.data.trackingUrl);
    } catch (err: any) {
      setSubmissionError(err.message || "אירעה שגיאה בביצוע ההזמנה. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-4">
        <span className="text-5xl block">🛒</span>
        <h2 className="text-2xl font-bold text-white">{t("empty_cart")}</h2>
        <p className="text-sm text-zinc-400">{t("empty_cart_cta")}</p>
        <Link
          href={`/r/${slug}/menu`}
          className="inline-block px-6 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 transition-colors"
        >
          לתפריט המסעדה ←
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-white">{t("checkout")}</h1>
        <Link href={`/r/${slug}/menu`} className="text-xs sm:text-sm font-bold text-amber-400 hover:underline">
          ← חזרה לתפריט
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Main Checkout Form (7 cols) */}
        <form onSubmit={handleSubmitOrder} className="lg:col-span-7 space-y-8">
          {/* Order Type Selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-3">
            <h2 className="text-base font-bold text-zinc-200">סוג הזמנה</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrderType("DELIVERY")}
                className={`py-3.5 px-4 rounded-2xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  cart.orderType === "DELIVERY"
                    ? "bg-amber-500 border-amber-400 text-zinc-950 shadow-md scale-[1.02]"
                    : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <span>🛵</span>
                <span>{t("delivery")}</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType("TAKEAWAY")}
                className={`py-3.5 px-4 rounded-2xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  cart.orderType === "TAKEAWAY"
                    ? "bg-amber-500 border-amber-400 text-zinc-950 shadow-md scale-[1.02]"
                    : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <span>🛍️</span>
                <span>{t("takeaway")}</span>
              </button>
            </div>
          </div>

          {/* Customer Details Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-200">{t("customer_info")}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t("full_name")} <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="ישראל ישראלי"
                  className={`w-full bg-zinc-800/80 border ${
                    formErrors.name ? "border-red-500" : "border-zinc-700"
                  } rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500`}
                />
                {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t("phone_number")} <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="050-1234567"
                    className={`w-full bg-zinc-800/80 border ${
                      formErrors.phone ? "border-red-500" : "border-zinc-700"
                    } rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500`}
                  />
                  {formErrors.phone && <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t("email_address")}
                  </label>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="israel@gmail.com"
                    className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address Form (if Delivery) */}
          {cart.orderType === "DELIVERY" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-base font-bold text-zinc-200">{t("delivery_address")}</h2>
              <DeliveryAddressForm
                value={deliveryAddress}
                onChange={setDeliveryAddress}
                errors={formErrors}
              />
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-base font-bold text-zinc-200">{t("payment_method")}</h2>

            <div className="space-y-3">
              {/* Credit Card Online */}
              <label
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentMethod === "CREDIT_CARD"
                    ? "bg-amber-500/10 border-amber-500 text-white"
                    : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "CREDIT_CARD"}
                    onChange={() => setPaymentMethod("CREDIT_CARD")}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-sm block">{t("credit_card")}</span>
                    <span className="text-xs text-zinc-400">תשלום מאובטח אונליין (Meshulam / Stripe)</span>
                  </div>
                </div>
                <span className="text-xl">💳</span>
              </label>

              {/* Gateway Choice if credit card */}
              {paymentMethod === "CREDIT_CARD" && (
                <div className="p-3 bg-zinc-850 rounded-xl border border-zinc-700/80 flex items-center justify-between text-xs text-zinc-300 mr-7">
                  <span>ספק סליקה מאובטח:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGateway("MESHULAM")}
                      className={`px-3 py-1 rounded-lg font-bold border transition-colors ${
                        gateway === "MESHULAM"
                          ? "bg-amber-500 text-zinc-950 border-amber-400"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      משולם עסקים (IL)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGateway("STRIPE")}
                      className={`px-3 py-1 rounded-lg font-bold border transition-colors ${
                        gateway === "STRIPE"
                          ? "bg-amber-500 text-zinc-950 border-amber-400"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      Stripe (Intl)
                    </button>
                  </div>
                </div>
              )}

              {/* Cash on Delivery / Pay at Counter */}
              {cart.orderType === "DELIVERY" ? (
                <label
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    paymentMethod === "CASH"
                      ? "bg-amber-500/10 border-amber-500 text-white"
                      : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "CASH"}
                      onChange={() => setPaymentMethod("CASH")}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-sm block">{t("cash")}</span>
                      <span className="text-xs text-zinc-400">תשלום במזומן בעת מסירת ההזמנה</span>
                    </div>
                  </div>
                  <span className="text-xl">💵</span>
                </label>
              ) : (
                <label
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    paymentMethod === "PAY_AT_COUNTER"
                      ? "bg-amber-500/10 border-amber-500 text-white"
                      : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "PAY_AT_COUNTER"}
                      onChange={() => setPaymentMethod("PAY_AT_COUNTER")}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-sm block">{t("pay_at_counter")}</span>
                      <span className="text-xs text-zinc-400">תשלום בקופה בעת איסוף ההזמנה</span>
                    </div>
                  </div>
                  <span className="text-xl">🏪</span>
                </label>
              )}
            </div>
          </div>

          {/* Submission Error Banner */}
          {submissionError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-semibold">
              ⚠️ {submissionError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-lg sm:text-xl shadow-xl shadow-amber-500/25 active:scale-98 transition-all flex items-center justify-between disabled:opacity-50"
          >
            <span>{loading ? t("processing_order") : t("place_order")}</span>
            <span className="bg-zinc-950/20 px-3 py-1 rounded-xl font-extrabold">
              ₪{cart.totalAmount.toFixed(0)}
            </span>
          </button>
        </form>

        {/* Right Cart Summary (5 cols) */}
        <div className="lg:col-span-5 sticky top-24">
          <CartSummary slug={slug} isCheckoutPage={true} />
        </div>
      </div>
    </div>
  );
}
