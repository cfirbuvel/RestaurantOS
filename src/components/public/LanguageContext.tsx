"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "he" | "en";
export type Direction = "rtl" | "ltr";

const translations: Record<Language, Record<string, string>> = {
  he: {
    restaurant_online: "הזמנה אונליין",
    delivery: "משלוח",
    takeaway: "איסוף עצמי",
    dine_in: "ישיבה במקום",
    cart: "סל הזמנות",
    empty_cart: "הסל שלך ריק כרגע",
    empty_cart_cta: "בחר מנות מהתפריט כדי להתחיל",
    add_to_cart: "הוסף להזמנה",
    edit: "ערוך",
    remove: "הסר",
    subtotal: "סכום ביניים",
    delivery_fee: "דמי משלוח",
    discount: "הנחה",
    tip: "טיפ לשליח / צוות",
    total: "סה״כ לתשלום",
    includes_vat: "כולל מע״מ כחוק (17%)",
    checkout: "מעבר לתשלום",
    order_now: "הזמן עכשיו",
    required_selection: "בחירת חובה",
    optional_selection: "תוספות לבחירה",
    special_notes: "הערות מיוחדות למנה",
    notes_placeholder: "לדוגמה: ללא בצל, רטבים בצד...",
    coupon_code: "קוד קופון / הנחה",
    apply_coupon: "החל קופון",
    coupon_applied: "קופון הופעל בהצלחה!",
    invalid_coupon: "קוד קופון לא תקין",
    customer_info: "פרטי המזמין",
    full_name: "שם מלא",
    phone_number: "מספר טלפון",
    email_address: "כתובת אימייל (לקבלת קבלה)",
    delivery_address: "כתובת למשלוח",
    city: "עיר",
    street: "רחוב",
    house_number: "מספר בית",
    floor: "קומה",
    apartment: "דירה",
    entrance: "כניסה",
    gate_code: "קוד כניסה לבניין",
    delivery_notes: "הוראות הגעה לשליח",
    payment_method: "אמצעי תשלום",
    credit_card: "כרטיס אשראי אונליין",
    cash: "מזומן לשליח",
    pay_at_counter: "תשלום בדלפק",
    pay_emv: "מסוף אשראי במסעדה",
    place_order: "אישור והזמנה",
    processing_order: "מעבד הזמנה...",
    order_confirmed: "ההזמנה התקבלה בהצלחה!",
    order_number: "מספר הזמנה",
    estimated_time: "זמן משוער",
    minutes: "דקות",
    status_received: "ההזמנה התקבלה",
    status_preparing: "במטבח בהכנה",
    status_ready: "ההזמנה מוכנה",
    status_in_transit: "השליח בדרך אליך",
    status_delivered: "ההזמנה נמסרה בהצלחה",
    live_tracking: "מעקב שליח חי (Live GPS)",
    kiosk_welcome: "ברוכים הבאים",
    kiosk_touch_start: "גע במסך להתחלת הזמנה",
    kiosk_upsell_title: "תרצה לשדרג לארוחה?",
    kiosk_upsell_desc: "הוסף צ'יפס פריך ופחית שתייה קרה ב-₪18 בלבד",
    kiosk_upsell_accept: "כן, שדרג לי!",
    kiosk_upsell_skip: "לא תודה, המשך",
    kiosk_terminal_prompt: "אנא הצמד או הכנס כרטיס אשראי למסוף",
    kiosk_order_callout: "מספר הקריאה שלך:",
    kiosk_auto_reset: "המסך יחזור להתחלה בעוד",
    seconds: "שניות",
    are_you_still_there: "האם אתה עדיין כאן?",
    continue_order: "המשך הזמנה",
    reset_order: "בטל והתחל מחדש",
  },
  en: {
    restaurant_online: "Online Ordering",
    delivery: "Delivery",
    takeaway: "Pickup",
    dine_in: "Dine In",
    cart: "Order Basket",
    empty_cart: "Your basket is empty",
    empty_cart_cta: "Choose dishes from the menu to start",
    add_to_cart: "Add to Order",
    edit: "Edit",
    remove: "Remove",
    subtotal: "Subtotal",
    delivery_fee: "Delivery Fee",
    discount: "Discount",
    tip: "Tip for Courier / Staff",
    total: "Total Amount",
    includes_vat: "Includes VAT (17%)",
    checkout: "Proceed to Checkout",
    order_now: "Order Now",
    required_selection: "Required Selection",
    optional_selection: "Optional Add-ons",
    special_notes: "Special Instructions",
    notes_placeholder: "e.g., No onions, dressings on the side...",
    coupon_code: "Promo / Coupon Code",
    apply_coupon: "Apply",
    coupon_applied: "Coupon applied successfully!",
    invalid_coupon: "Invalid coupon code",
    customer_info: "Customer Details",
    full_name: "Full Name",
    phone_number: "Phone Number",
    email_address: "Email Address (for receipt)",
    delivery_address: "Delivery Address",
    city: "City",
    street: "Street",
    house_number: "House #",
    floor: "Floor",
    apartment: "Apt #",
    entrance: "Entrance",
    gate_code: "Door Code",
    delivery_notes: "Courier Notes",
    payment_method: "Payment Method",
    credit_card: "Credit Card Online",
    cash: "Cash on Delivery",
    pay_at_counter: "Pay at Counter",
    pay_emv: "EMV Card Terminal",
    place_order: "Place Order",
    processing_order: "Processing Order...",
    order_confirmed: "Order Placed Successfully!",
    order_number: "Order #",
    estimated_time: "Estimated Time",
    minutes: "minutes",
    status_received: "Order Received",
    status_preparing: "Preparing in Kitchen",
    status_ready: "Ready for Pickup",
    status_in_transit: "Courier on the Way",
    status_delivered: "Delivered Successfully",
    live_tracking: "Live Courier GPS Tracking",
    kiosk_welcome: "Welcome",
    kiosk_touch_start: "Touch Screen to Start Order",
    kiosk_upsell_title: "Make it a Combo?",
    kiosk_upsell_desc: "Add crispy fries and a cold drink for just ₪18",
    kiosk_upsell_accept: "Yes, Upgrade Combo!",
    kiosk_upsell_skip: "No thanks, continue",
    kiosk_terminal_prompt: "Please tap or insert card on the payment terminal",
    kiosk_order_callout: "Your Order Call Number:",
    kiosk_auto_reset: "Screen resets in",
    seconds: "seconds",
    are_you_still_there: "Are you still there?",
    continue_order: "Continue Order",
    reset_order: "Cancel & Start Over",
  },
};

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "he",
  direction: "rtl",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("he");

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof document !== "undefined") {
      document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "he" ? "en" : "he");
  };

  const direction: Direction = language === "he" ? "rtl" : "ltr";

  const t = (key: string): string => {
    return translations[language][key] || translations["he"][key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        direction,
        setLanguage,
        toggleLanguage,
        t,
      }}
    >
      <div dir={direction} className={language === "he" ? "font-hebrew" : "font-sans"}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
