# RestaurantOS — Shared Mobile Design System & UX Hardening Specification

**Document ID:** `DOC-MOB-DESIGN-001`  
**Version:** `1.0.0`  
**Phase:** Phase 18 Shared Mobile Design System + UX Hardening  
**Status:** Canonical Mobile Design Contract  
**Scope:** Android Manager App (`apps/manager-android`), Android Driver App (`apps/driver-android`), Shared Mobile Package (`apps/shared-mobile`)

---

## 1. Executive Summary & Philosophy

RestaurantOS mobile applications serve frontline restaurant professionals operating under high noise, greasy/wet screens, intense sunlight, rapid time pressure, and delivery transit.

Mobile UX is guided by four non-negotiable operational principles:
1. **Clarity > Decoration:** Eliminate decorative gradients, ambient shadows, and unnecessary visual ornamentation in favor of immediate glanceability.
2. **Speed > Animation:** Micro-interactions must not block workflow. Animations are strictly capped between 150ms and 250ms.
3. **Reliability > Visual Complexity:** The UI must maintain consistent layout and error messaging even during network disconnections, app backgrounding, and high concurrency.
4. **Tri-Factor Status Certainty:** Operational status **must never rely on color alone**. Every status indication is reinforced simultaneously by a distinct color tint, an operational icon, and a precise Hebrew term.

---

## 2. Shared Design Tokens (`@restaurantos/shared-mobile`)

### 2.1 Color Palette
- **Background:** Deep Night Slate `#090D16` (reduces battery drain on OLED screens, optimal contrast outdoors).
- **Surface:** `#111827` (Card canvas), Elevated `#1F2937` (Modals/Sheets), Highlight `#374151` (Active rows).
- **Brand Accent:** Warm Amber `#F59E0B` (RestaurantOS identity), Secondary Blue `#3B82F6` (Operational actions).
- **Typography:** Primary `#F9FAFB`, Secondary `#9CA3AF`, Muted `#6B7280`, High-Contrast Text `#FFFFFF`.

### 2.2 Tri-Factor Status Semantics Matrix
| Semantic State | Color Token | Hex | Background (Tint) | Border | Icon Name | Hebrew Label | Operational Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SUCCESS` | `status.success` | `#10B981` | `rgba(16, 185, 129, 0.15)` | `rgba(16, 185, 129, 0.35)` | `CheckCircle2` | הצלחה | Action successfully confirmed |
| `WARNING` | `status.warning` | `#F59E0B` | `rgba(245, 158, 11, 0.15)` | `rgba(245, 158, 11, 0.35)` | `AlertTriangle` | לתשומת לב | SLA approaching / attention |
| `ERROR` | `status.error` | `#EF4444` | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.35)` | `AlertOctagon` | שגיאה | Request rejected / validation error |
| `PENDING` | `status.pending` | `#F59E0B` | `rgba(245, 158, 11, 0.12)` | `rgba(245, 158, 11, 0.30)` | `Clock` | ממתין | Awaiting dispatcher / server ack |
| `ACTIVE` | `status.active` | `#3B82F6` | `rgba(59, 130, 246, 0.15)` | `rgba(59, 130, 246, 0.35)` | `Activity` | פעיל | In-progress workflow |
| `UNAVAILABLE` | `status.unavailable` | `#6B7280` | `rgba(107, 114, 128, 0.15)` | `rgba(107, 114, 128, 0.30)` | `Slash` | לא זמין | Temporarily out of service |
| `OFFLINE` | `status.offline` | `#DC2626` | `rgba(220, 38, 38, 0.18)` | `rgba(220, 38, 38, 0.40)` | `WifiOff` | לא מחובר | Network socket disconnected |

### 2.3 Spacing Scale & Touch Ergonomics
- Scale: `xxs: 2`, `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`, `xxxl: 48`.
- **Minimum Touch Target:** `48dp` (WCAG 2.1 AA requirement).
- **Comfortable Handheld Target:** `56dp`.
- **High-Velocity Operational Target (Driver/Bump):** `64dp`.

### 2.4 Typography Hierarchy
- `displayLarge`: 32px / 38px / 800 (Extra Bold) — Urgent metrics & KDS counters.
- `titleLarge`: 24px / 30px / 700 (Bold) — Screen headlines.
- `titleMedium`: 18px / 24px / 600 (Semi Bold) — Card headers & modal titles.
- `titleSmall`: 16px / 20px / 600 (Semi Bold) — Section headers.
- `bodyLarge`: 16px / 22px / 400 (Regular) — Inputs & order descriptions.
- `bodyMedium`: 14px / 20px / 400 (Regular) — List items & customer addresses.
- `bodySmall`: 12px / 16px / 400 (Regular) — Secondary notes.
- `caption`: 11px / 14px / 500 (Medium) — Timestamps & status tags.
- `metricValue`: 28px / 34px / 800 (Extra Bold, Tabular) — Revenue & order counters.
- `monoTimer`: 20px / 24px / 700 (Tabular) — Delivery SLA timers.

---

## 3. Hebrew RTL & Bidirectional Isolation Rules

Hebrew is a first-class citizen across all mobile interfaces (`I18nManager.forceRTL(true)`).
To prevent bidirectional text corruptions (inversions of numbers, phone numbers, and codes), strict isolation functions are implemented in `src/core/rtl-utils.ts`:

1. **Phone Numbers (`formatPhoneNumber`):**
   Wrapped with Left-to-Right Embedding (`\u202A ... \u202C`) so hyphens and country codes are never inverted by adjacent Hebrew text.
2. **Order Identifiers (`formatOrderId`):**
   Prefixed with Left-to-Right Mark (`\u200E#1042\u200E`) ensuring `#` remains on the left side of the order number regardless of text flow.
3. **Addresses (`formatAddress`):**
   Structured in canonical Hebrew order: `[שם רחוב] [מספר בית], [עיר]`.
4. **Currency (`formatCurrency`):**
   Emits Shekel symbol with tabular formatting: `₪124.50`.
5. **Mixed Alphanumeric Strings (`bidiIsolate`):**
   Wraps external entity references (e.g. "Order #12 from Wolt") in First Strong Isolate (`\u2068 ... \u2069`).

---

## 4. Operational Component Catalog

| Component | File Path | Key Features |
| :--- | :--- | :--- |
| `StatusBadge` | `src/components/StatusBadge.tsx` | Tri-factor status pill with icon, tinted background, border, and localized Hebrew text. |
| `ActionButton` | `src/components/ActionButton.tsx` | Touch target >= 48dp, loading indicator, accessible states, multiple variants (`primary`, `secondary`, `danger`, `success`, `outline`, `warning`, `muted`). |
| `Card` | `src/components/Card.tsx` | High-contrast tactile card surface, optional press handler with active opacity, low/medium elevation. |
| `ConfirmDialog` | `src/components/ConfirmDialog.tsx` | High-visibility confirmation/destructive dialog with primary and cancel actions. |
| `ContentModal` | `src/components/ContentModal.tsx` | Scrollable modal sheet with header, close target >= 48dp, body, and action footer. |
| `ScreenHeader` | `src/components/ScreenHeader.tsx` | Accessible back navigation (min 48dp), RTL-aware chevron, centered title, action slot. |
| `OfflineBanner` | `src/components/OfflineBanner.tsx` | Animated connectivity bar supporting `ONLINE`, `RECONNECTING`, `OFFLINE` with `WifiOff` icon. |
| `LoadingState` | `src/components/LoadingState.tsx` | Full-screen and inline loading states. **Never show blank screens.** |
| `SkeletonLine` | `src/components/SkeletonLine.tsx` | Shimmer animated placeholder for skeleton list/card rendering. |
| `ErrorState` | `src/components/ErrorState.tsx` | Operational error presentation: Explains **What happened**, **What the user can do**, and provides an immediate recovery action (e.g. "רענן"). |
| `EmptyState` | `src/components/EmptyState.tsx` | Clean empty-list illustration with operational message and optional action. |
| `TextInput` | `src/components/TextInput.tsx` | Accessible input with label, RTL text alignment, focus/error borders, helper text. |
| `Alert` | `src/components/Alert.tsx` | Inline operational notification banner with icon, message, and optional dismiss. |

---

## 5. Accessibility & Ergonomics (WCAG 2.1 AA)

1. **Touch Targets:** Minimum geometry of 48×48dp across all interactive elements (`touchTargetStyle()`).
2. **Font Scaling Safeguard (`MAX_FONT_SCALE = 1.5`):** Text elements declare `maxFontSizeMultiplier={1.5}` to accommodate accessibility zoom without truncating critical operational details.
3. **Screen Reader Semantics:** Buttons, badges, and modals implement TalkBack-compatible roles (`accessibilityRole="button"`, `accessibilityLiveRegion="assertive"`, `accessibilityViewIsModal={true}`).
4. **Contrast Ratios:** Contrast on dark surfaces exceeds 4.5:1 for body copy and 3.0:1 for large headers and status borders.

---

## 6. Migration Roadmap & Technical Debt Tracking

> [!IMPORTANT]
> **Tracked Architecture Action Item (Phase 19 & Phase 20)**:
> In Phase 18, both `apps/manager-android` and `apps/driver-android` were migrated to consume `@restaurantos/shared-mobile` using **backward-compatible re-export shims**:
> - `apps/manager-android/src/theme/theme.ts`
> - `apps/driver-android/src/theme/theme.ts`
> - `apps/manager-android/src/components/*`
> - `apps/driver-android/src/components/*`
> - `apps/manager-android/src/core/offline/offline-banner.tsx`
> - `apps/driver-android/src/core/offline/offline-banner.tsx`
> 
> **Future Refactoring Plan:**
> 1. **Phase 19 (Multi-Client Integration):** As screens are integrated end-to-end, update imports from relative `../theme/theme` and `../components/*` to direct package imports:
>    ```tsx
>    import { ActionButton, Card, StatusBadge, colors, spacing } from "@restaurantos/shared-mobile";
>    ```
> 2. **Phase 20 (Production Hardening):** Retire the local shim files in `apps/manager-android/src/components/` and `apps/driver-android/src/components/`, leaving only app-specific screens and core contexts.
