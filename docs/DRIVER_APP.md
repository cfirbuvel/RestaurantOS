# RestaurantOS — Driver Android Application

**Phase:** 15 — Driver Android Application  
**Target:** Android (Expo / React Native)  
**Location:** `apps/driver-android/`  
**Date:** 2026-09-22  

---

## 1. Executive Summary & Design Principles

The RestaurantOS Driver Android Application provides couriers with an intuitive, battery-efficient, high-contrast mobile interface for managing shifts and fulfilling deliveries.

### Key Architectural Principles

1. **Battery Conservation via Spot Confirmation**:
   - Primary vehicle/driver tracking is delegated to a dedicated 3rd-party hardware GPS tracker.
   - The driver mobile app does **not** run background location tracking.
   - The app uses one-shot GPS fixes (`expo-location`) exclusively at critical delivery lifecycle checkpoints (`arrive` and `complete`) for geofencing/proof-of-presence confirmation.
2. **Two-Tier Authentication & Local PIN Unlock**:
   - Initial authentication requires email + password against `POST /api/v1/auth/login`.
   - On first login, the driver establishes a 4-to-6 digit PIN.
   - The PIN is hashed using SHA-256 before storage in `expo-secure-store`.
   - Subsequent app launches require only the PIN for fast access without plaintext credential re-entry.
   - Forgotten PIN or explicit logout clears the local PIN hash and requires re-entering email and password.
3. **Security & Data Sanitization**:
   - Data minimization (PHASE 00 Section 31): Courier screens receive `DeliveryViewDTO`, masking customer payment details, credit cards, or internal CRM profiles.
   - Strict UI Error Sanitization: Technical runtime exceptions, database errors, or stack traces are never exposed to the driver UI. Errors are mapped to clear, localized messages.
4. **Offline Resilience & Race-Safe Concurrency**:
   - Current active delivery and driver profiles are cached locally in SecureStore / memory storage.
   - Delivery self-assignment uses atomic backend transactions; concurrent claims by other couriers return `409 Conflict`, which is surfaced gracefully as an informative toast without desyncing the app.

---

## 2. Driver App Architecture & Folder Layout

```
apps/driver-android/
├── App.tsx                          # Root application container & navigation router
├── app.json                         # Expo configuration (dark theme, portrait lock)
├── index.js                         # registerRootComponent entry point
├── metro.config.js                  # Metro bundler config
├── package.json                     # Driver app dependencies (Expo 57, React Native 0.86)
├── tsconfig.json                    # Standalone TypeScript compiler options
└── src/
    ├── components/
    │   ├── ActionButton.tsx         # Accessible touch target button (48dp min)
    │   ├── Card.tsx                 # Dark-mode container card
    │   ├── Header.tsx               # RTL-aware top header bar
    │   ├── Modal.tsx                # Destructive/confirmation dialogs
    │   └── StatusBadge.tsx          # Shift, assignment & trip state badges
    ├── config/
    │   └── api-config.ts            # Backend API base URL & timeouts
    ├── core/
    │   ├── auth/
    │   │   ├── auth-context.tsx     # Session management, PIN lock, driver profile
    │   │   ├── pin-hash.ts          # Pure TypeScript SHA-256 PIN hashing utility
    │   │   └── token-storage.ts     # Expo SecureStore wrapper with memory fallback
    │   ├── i18n/
    │   │   ├── i18n-context.tsx     # Hebrew (RTL) / English (LTR) language context
    │   │   └── translations.ts      # Comprehensive Hebrew & English strings
    │   ├── location/
    │   │   └── location-service.ts  # One-shot GPS fix service (8s timeout, non-blocking)
    │   ├── network/
    │   │   └── mobile-api-client.ts # Typed HTTP client (Bearer JWT & X-Branch-Id)
    │   └── offline/
    │       ├── offline-banner.tsx   # Visual indicator for network disconnection
    │       └── offline-manager.ts   # Network connectivity listener
    ├── screens/
    │   ├── AuthScreen.tsx           # Credentials login, PIN setup, PIN unlock
    │   ├── CurrentDeliveryScreen.tsx# Active delivery lifecycle actions, maps link
    │   ├── DeliveryQueueScreen.tsx  # Unassigned available deliveries + self-assignment
    │   ├── HomeScreen.tsx           # Shift status, availability queue info, quick actions
    │   ├── NotificationsScreen.tsx  # Notification list & push device token registration
    │   ├── SettingsScreen.tsx       # Profile info, language toggle, reset PIN, logout
    │   └── ShiftScreen.tsx          # Clock-in, break, return, restaurant arrival, clock-out
    └── theme/
        └── theme.ts                 # High-contrast outdoor palette & typography
```

---

## 3. Shift State Machine

The driver app coordinates with the backend driver queue service across 3 dimensions:
- `shift_status`: `OFF_SHIFT` | `ON_SHIFT` | `BREAK`
- `assignment_status`: `AVAILABLE` | `ASSIGNED`
- `trip_status`: `NOT_STARTED` | `IN_TRANSIT` | `AT_CUSTOMER` | `RETURNING`

```
                     ┌───────────────┐
                     │   OFF_SHIFT   │
                     └───────┬───────┘
                             │ clock-in
                             ▼
                     ┌───────────────┐
       ┌────────────►│   ON_SHIFT    │◄─────────────┐
       │             └───────┬───────┘              │
       │ break               │ clock-out            │ return-from-break
       ▼                     ▼                      │
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│     BREAK     │     │   OFF_SHIFT   │     │     BREAK     │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

## 4. Delivery Lifecycle & Geofence Confirmation

```
AVAILABLE_FOR_ASSIGNMENT (Queried via GET /api/v1/deliveries?status=AVAILABLE_FOR_ASSIGNMENT)
        │
        │ self-assign (POST /api/v1/deliveries/:id/self-assign)
        ▼
     ASSIGNED
        │
        │ start (POST /api/v1/deliveries/:id/start)
        ▼
    PICKED_UP
        │
        │ pickup (POST /api/v1/deliveries/:id/pickup)
        ▼
 OUT_FOR_DELIVERY
        │
        │ arrive (POST /api/v1/deliveries/:id/arrive)
        │  ↳ Spot GPS fix sent to POST /api/v1/telemetry/location
        ▼
ARRIVED_AT_CUSTOMER_AREA
        │
        │ complete (POST /api/v1/deliveries/:id/complete)
        │  ↳ Spot GPS fix sent to POST /api/v1/telemetry/location
        ▼
    DELIVERED (Driver returns to AVAILABLE, trip status RETURNING)
```

---

## 5. Verification & Tests

- `tests/unit/driver-me-endpoint.spec.ts`: Tests `GET /api/v1/drivers/me` authentication, 401 handling, auto-creation of DriverRecord, and returning existing driver records.
- `tests/unit/driver-app.spec.ts`: Tests SHA-256 PIN hashing consistency, shift transitions, delivery self-assignment, atomic 409 conflict handling, and graceful location service degradation.
