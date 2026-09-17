# Phase 9 Manual Testing Guide — Customer Ordering Channels (Website & Kiosk)

This guide documents the end-to-end manual verification workflows for **Phase 9: Customer Ordering Channels**, covering both the **Public Website Storefront** and the **Self-Service Kiosk Terminal**.

---

## 1. Overview of Channels

| Channel | URL Pattern | Audience | Key Features |
| :--- | :--- | :--- | :--- |
| **Website Storefront** | `/r/[slug]` (e.g. `/r/israeli-burgers`) | Web / Mobile Customers | SEO Optimized (SSR), JSON-LD, LTR/RTL Toggle, Guest Checkout, Cash / Meshulam / Stripe, Live GPS Tracking |
| **Self-Service Kiosk** | `/kiosk/[branchId]` | In-Restaurant Diners | 64px+ Touch Targets, 120s Inactivity Timer, Upsell Prompts, Mock EMV Terminal Handshake, Order Callout |

---

## 2. Test Scenarios: Public Website Storefront

### 2.1 Landing Page & SEO Inspection
1. Navigate to `http://localhost:3000/r/israeli-burgers`.
2. **Verify Branding**: Check restaurant name ("Israeli Burgers"), tagline, opening hours, address, and live open status badge.
3. **Inspect Page Source**:
   - Check `<script type="application/ld+json">` containing `"@type": "Restaurant"`.
   - Verify OpenGraph tags (`og:title`, `og:description`).
4. Click **"לתפריט והזמנה אונליין"** → verifies navigation to `/r/israeli-burgers/menu`.

### 2.2 Interactive Menu & Modifier Customization
1. On `/r/israeli-burgers/menu`, verify category navigation tabs (המבורגרים, תוספות, שתייה).
2. Click on a burger card (e.g., "המבורגר שורטק").
3. **Modifier Modal**:
   - Verify doneness selection (M, MW, WD).
   - Toggle toppings / sauces.
   - Adjust quantity (+ / -).
   - Enter special instructions (e.g., "ללא בצל").
   - Click "הוסף להזמנה" → verify cart badge counter updates.
4. **Language Toggle**:
   - Click "EN" in the top bar → verify interface switches to English with LTR direction.
   - Click "עב" → verify Hebrew RTL layout resumes.

### 2.3 Cart & Promotional Coupon
1. Open the Cart Drawer or review the sticky desktop sidebar.
2. Enter coupon code `WELCOME10` and click "החל קופון".
   - Verify 10% discount is computed and subtracted from total.
3. Select Courier Tip (₪5, ₪10, ₪15).
4. Click **"מעבר לתשלום"** → navigates to `/r/israeli-burgers/checkout`.

### 2.4 Checkout & Payment Options
1. On `/r/israeli-burgers/checkout`:
   - Switch between **משלוח (Delivery)** and **איסוף עצמי (Takeaway)**.
   - Fill in Customer Details (Full Name, Phone).
   - Fill in Delivery Address (City, Street, House #, Floor, Notes).
2. **Payment Method Verification**:
   - Select **כרטיס אשראי אונליין (Credit Card)** → choose Meshulam or Stripe.
   - Select **מזומן לשליח (Cash on Delivery)** or **תשלום בדלפק (Pay at Counter)**.
3. Click **"אישור והזמנה"** → verifies redirection to `/r/israeli-burgers/order/[orderId]?token=[token]`.

### 2.5 Live Order Confirmation & GPS Tracking
1. On the order confirmation page:
   - Verify order status progression bar (התקבלה → בהכנה במטבח → מוכנה → בדרך אליך → נמסרה).
   - Verify Live GPS Telemetry card displays simulated courier coordinates, driver name, vehicle speed, and live pulsing radar.
   - Verify status polls every 5 seconds without manual refresh.

---

## 3. Test Scenarios: Self-Service Kiosk

### 3.1 Attract Screen
1. Navigate to `http://localhost:3000/kiosk/be7c3e30-b28b-4d23-9d78-b56b545351f5`.
2. Verify full-screen design with animated glowing CTA and language toggle.
3. Tap **"גע במסך להתחלת הזמנה"** → opens `/kiosk/.../menu`.

### 3.2 Touch Ordering & Upsell Rules
1. On the kiosk menu page:
   - Select category tabs on the left/right panel.
   - Touch product items (large touch cards).
   - Select required modifiers.
2. Tap **"מעבר לתשלום"**:
   - Verify the **Deterministic Upsell Prompt** appears ("האם תרצה לשדרג לארוחה עם צ'יפס ופחית שתייה ב-₪18?").
   - Click "כן, שדרג לי!" or "לא תודה, המשך".

### 3.3 Touch Checkout & Mock EMV Card Terminal Handshake
1. On the kiosk checkout page:
   - Touch **ישיבה במסעדה (Dine In)** or **איסוף לקחת (Takeaway)**.
   - Choose **תשלום במסוף אשראי (EMV Terminal)**.
   - Verify the EMV modal pops up with NFC pulse: "אנא הצמד או הכנס כרטיס אשראי למסוף".
   - Verify automatic sequence: `הצמדת כרטיס` → `אישור עסקה מול מסוף` → `העסקה אושרה בהצלחה`.

### 3.4 Callout Screen & Inactivity Auto-Reset
1. Verify Kiosk Order Confirmation screen appears with prominent callout number (e.g., `#104`).
2. Verify 15-second countdown timer automatically returns kiosk to the Attract Screen.
3. Test 120s Inactivity Guard on the menu: idle for 100s → warning modal pops up with 20s countdown.

---

## 4. Verification Checklist

- [x] Unauthenticated read-only Menu API `/api/v1/public/:slug/menu` cached with CDN headers.
- [x] Server-authoritative cart price validation (client prices ignored).
- [x] Guest checkout with optional customer CRM profile link.
- [x] Multi-language support: Hebrew-first (RTL) + English (LTR) toggle.
- [x] Payment support for Online Card (Meshulam/Stripe), Cash on Delivery, and Pay at Counter.
- [x] Live GPS courier tracking and order status polling.
- [x] Fullscreen touch Kiosk mode with 120s inactivity guard and mock EMV handshake.
- [x] Dashboard Phase 9 navigation tab and live channel status.
