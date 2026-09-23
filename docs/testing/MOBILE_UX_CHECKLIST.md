# RestaurantOS — Mobile UX & Ergonomics Verification Checklist

**Document ID:** `CHECKLIST-MOB-UX-001`  
**Phase:** Phase 18 Shared Mobile Design System + UX Hardening  
**Target Clients:** `apps/manager-android`, `apps/driver-android`, `@restaurantos/shared-mobile`  
**Date:** 2026-09-23  
**Status:** PASS — Verified  

---

## 1. Representative Device Profile Matrix

| Profile | Device Class | Resolution / Viewport | Density | Target Operational Environment |
| :--- | :--- | :--- | :--- | :--- |
| **Small / Rugged** | Compact Handheld (e.g. Zebra TC21, Galaxy A10) | 360 × 640 dp | ~320 dpi (xhdpi) | Driver motorbike mount, delivery pocket terminal |
| **Standard Mobile** | Modern Handheld (e.g. Pixel 7, Galaxy S22) | 390 × 844 dp | ~420 dpi (xxhdpi) | Restaurant Manager floor terminal |
| **Large Phablet** | Tall Handheld (e.g. Pixel 8 Pro, Galaxy Ultra) | 412 × 915 dp | ~480 dpi (xxxhdpi) | Expeditor station / Manager dispatch table |
| **Tablet / Kiosk** | Compact Tablet (e.g. Galaxy Tab A 8.0, iPad Mini) | 768 × 1024 dp | ~260 dpi (hdpi) | Manager office desk, host stand |

---

## 2. Ergonomics & Touch Target Checklist (WCAG 2.1 AA)

| Test Item | Threshold | Validation Result | Notes / Observed Behavior |
| :--- | :--- | :--- | :--- |
| **Bottom Navigation Bar** | Height ≥ 64dp, Touch Target ≥ 48dp | ✅ PASS | All 7 tabs on Manager App maintain 48dp hitboxes with `paddingVertical: 4`. |
| **Action Buttons (`ActionButton`)** | Min Height 48dp (sm: 40dp, lg: 56dp) | ✅ PASS | Button heights conform to `touchTargets.min` (48dp). No mis-taps during rush simulation. |
| **Status Badges (`StatusBadge`)** | Text + Icon container | ✅ PASS | Text padding accommodates finger targets; interactive badges wrapped with 48dp minimum. |
| **Screen Header Back Target** | Min Width/Height ≥ 48dp | ✅ PASS | `ScreenHeader` defines `minWidth: 48, minHeight: 48` on `backBtn`. |
| **Modal Dismiss Triggers** | Min Width/Height ≥ 48dp | ✅ PASS | Modal close target (`X` button) enclosed in 48×48dp hit area. |
| **Branch Selector Header** | Min Height ≥ 40dp + Padding | ✅ PASS | Manager top bar selector is easily tappable with single thumb. |

---

## 3. Hebrew RTL & Bidirectional Formatting Checklist

| Test Scenario | Input String | Target Output (Rendered) | Status | Verification Detail |
| :--- | :--- | :--- | :--- | :--- |
| **Phone Number** | `054-123-4567` surrounded by Hebrew | `\u202A054-123-4567\u202C` | ✅ PASS | Isolated LTR; hyphens do not shift to the right of the phone prefix. |
| **Order Identifier** | `1042` or `#1042` | `\u200E#1042\u200E` | ✅ PASS | Hash symbol remains locked to the left of numbers in Hebrew sentences. |
| **Currency Value** | `124.50` | `₪124.50` | ✅ PASS | Shekel sign placed correctly with tabular spacing; no numeric reversal. |
| **Street Address** | `דיזנגוף`, `100`, `תל אביב` | `דיזנגוף 100, תל אביב` | ✅ PASS | Natural Hebrew street-before-number order preserved. |
| **Mixed Alphanumeric** | `Order #42 at Wolt` | `\u2068Order #42 at Wolt\u2069` | ✅ PASS | Embedded in FSI/PDI to prevent bidirectional text spillover. |
| **Operational SLA** | `15` minutes | `15 דק׳` | ✅ PASS | Formatted with localized abbreviation and tabular numerals. |
| **Navigation Flow** | Bottom navigation / rows | `flexDirection: row-reverse` | ✅ PASS | First tab starts at right, reading order matches Hebrew eye scan. |

---

## 4. Status Semantics Checklist (Tri-Factor Rule)

Status **must not rely on color alone**. Every status indication verified on both apps:

| Operational State | Background Tint | Border Color | Icon | Hebrew Label | Tri-Factor Pass |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CONFIRMED` / `ACCEPTED` | `rgba(59, 130, 246, 0.15)` | Blue `#3B82F6` | `CheckCircle` | מאושר | ✅ PASS |
| `IN_PREPARATION` | `rgba(245, 158, 11, 0.15)` | Amber `#F59E0B` | `Flame` | בהכנה | ✅ PASS |
| `READY` | `rgba(16, 185, 129, 0.15)` | Green `#10B981` | `BellRing` | מוכן | ✅ PASS |
| `ASSIGNED` / `IN_TRANSIT` | `rgba(139, 92, 246, 0.15)` | Purple `#8B5CF6` | `Truck` / `Navigation` | משויך / בדרך | ✅ PASS |
| `COMPLETED` | `rgba(107, 114, 128, 0.15)` | Gray `#6B7280` | `CheckCheck` | הושלם | ✅ PASS |
| `CANCELLED` | `rgba(239, 68, 68, 0.15)` | Red `#EF4444` | `XCircle` | בוטל | ✅ PASS |
| `SLA_BREACH` / `CRITICAL`| `rgba(239, 68, 68, 0.18)` | Red `#EF4444` | `AlertTriangle` | חריגת SLA | ✅ PASS |
| `ON_BREAK` | `rgba(249, 115, 22, 0.15)` | Orange `#F97316` | `Coffee` | בהפסקה | ✅ PASS |
| `OFF_SHIFT` | `rgba(75, 85, 99, 0.20)` | Slate `#4B5563` | `Moon` | לא במשמרת | ✅ PASS |
| `OFFLINE` | `rgba(220, 38, 38, 0.18)` | Red `#DC2626` | `WifiOff` | לא מחובר | ✅ PASS |

---

## 5. Loading & Error UX Hardening Checklist

| UX Domain | Standard | Validation Result | Implementation Notes |
| :--- | :--- | :--- | :--- |
| **Blank Screen Prevention** | Never render blank view during data fetching | ✅ PASS | `LoadingState` renders centered spinner + message. `SkeletonLine` provides content shimmer. |
| **Error Communication** | Explain **What happened** + **What user can do** | ✅ PASS | `ErrorState` shows clear Hebrew headline, description, and primary `[רענן]` (Refresh) button. |
| **Zero Stack Trace Policy** | Never show raw exceptions to user | ✅ PASS | All backend error codes mapped to user-actionable instructions. Technical logs kept in console. |
| **Offline Banner State** | Seamless transition between states | ✅ PASS | Animated opacity change between `ONLINE` (hidden), `RECONNECTING` (amber), and `OFFLINE` (red). |

---

## 6. Accessibility & Font Zoom Checklist

| Test Item | Verification Criteria | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Font Scaling Clamp** | `maxFontSizeMultiplier={1.5}` | ✅ PASS | Large system accessibility zoom does not push buttons off screen or clip card badges. |
| **TalkBack Accessibility** | `accessibilityRole` and `accessibilityLabel` | ✅ PASS | Screen reader announces roles for buttons, alerts, status text, and modal containers. |
| **Color Contrast** | WCAG 2.1 AA (≥ 4.5:1 for body copy) | ✅ PASS | High-contrast text `#F9FAFB` on `#090D16` canvas achieves > 15:1 contrast ratio. |

---

## 7. Findings & Applied Fixes

1. **Manager Notification Screen Missing i18n Key:**
   - *Finding:* `t("unread")` in `NotificationsScreen.tsx` threw a type error due to missing key in dictionary.
   - *Fix:* Added `unread: "חדשות"` (Hebrew) and `unread: "Unread"` (English) to `translations.ts`.
2. **Driver App Monorepo Resolution:**
   - *Finding:* Driver Metro bundler was missing monorepo path resolution for `@/shared` and `@restaurantos/shared-mobile`.
   - *Fix:* Aligned `apps/driver-android/metro.config.js` with workspace root watch folders and module mappings.
3. **TextInput Event Typing in React Native:**
   - *Finding:* React Native synthetic focus/blur events had slight signature divergence from DOM events in shared tsconfig.
   - *Fix:* Handled event casting cleanly and guarded accessibility invalid state via `aria-invalid`.
4. **Native RTL Driver / Manager Parity:**
   - *Finding:* Manager app was only flipping flex directions in JS styles without calling `I18nManager.forceRTL(true)`.
   - *Fix:* Unified in shared `I18nProvider` so both apps invoke native Android RTL engine.
