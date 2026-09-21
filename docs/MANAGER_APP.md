# RestaurantOS — Restaurant Manager Android Application

**Document ID:** `DOC-APP-MANAGER-001`  
**Version:** `1.0.0`  
**Phase:** Phase 14 Foundation + MVP  
**Status:** Certified & Implemented  
**Target Surface:** Android-first (React Native / Expo) Mobile Application  
**Package / ID:** `com.shortech.restaurantos.manager` (`apps/manager-android/`)  

---

## 1. Overview & Operational Role

The **RestaurantOS Manager Application** serves as the primary mobile command center for restaurant general managers, shift supervisors, and floor expeditors. Unlike the desktop Web Backoffice (which focuses on catalog setup, supply chain, and administrative configuration) and the dedicated KDS/Driver apps (which focus on linear execution), the Manager App prioritizes **live floor operations**:

```text
                               +-----------------------------+
                               |     RestaurantOS Server     |
                               +--------------+--------------+
                                              |
                   REST APIs (/api/v1/*)      |    Realtime Ticket Handshake
                   & RFC 7807 Errors          |    & Snapshot Resync
                                              |
                               +--------------v--------------+
                               |  RestaurantOS Manager App   |
                               |    (apps/manager-android)   |
                               +--------------+--------------+
                                              |
        +------------------+------------------+------------------+------------------+
        |                  |                  |                  |                  |
   Operational        Universal         Delivery Queue      Driver Roster      KDS Station
    Dashboard           Orders          & Smart Batches       & Tracking        Health Rail
```

---

## 2. Architecture & Clean Layering

The application is structured into three clean, decoupled architectural layers:

```text
apps/manager-android/
├── src/
│   ├── theme/
│   │   └── theme.ts              # Semantic dark palette, 48dp min touch targets, WCAG AA contrast
│   ├── core/
│   │   ├── auth/
│   │   │   ├── auth-context.tsx  # React Context for PIN, password auth, branch switching
│   │   │   └── token-storage.ts  # MobileTokenStorageAdapter (Keystore / secure storage)
│   │   ├── network/
│   │   │   └── mobile-api-client.ts # Platform-neutral RestaurantOSClient instance
│   │   ├── offline/
│   │   │   ├── offline-manager.ts   # Connectivity listener, read-only cache, mutation blocker
│   │   │   └── offline-banner.tsx   # Visual status banner (Offline / Reconnecting)
│   │   └── i18n/
│   │       ├── translations.ts      # Bilingual dictionary (Hebrew RTL / English LTR)
│   │       └── i18n-context.tsx     # Directional context & string resolution
│   ├── components/
│   │   ├── StatusBadge.tsx       # Multi-state semantic badges (Orders, Deliveries, Drivers, SLA)
│   │   ├── Card.tsx              # Elevated dark card containers
│   │   ├── ActionButton.tsx      # Touch-accessible (>=48dp) action buttons with loading states
│   │   ├── Header.tsx            # Active branch indicator, realtime dot, unread notifications
│   │   └── Modal.tsx             # Sheet / bottom modal for quick actions and details
│   └── screens/
│       ├── AuthScreen.tsx        # 4-digit PIN keypad + email/password login
│       ├── BranchSelectScreen.tsx# Active branch selection & switching
│       ├── DashboardScreen.tsx   # Live control center (today's orders, deliveries, drivers, SLA)
│       ├── OrdersScreen.tsx      # Orders rail, status filter tabs, lifecycle domain actions
│       ├── DeliveriesScreen.tsx  # Delivery queue, manual driver assignment, batch approval
│       ├── DriversScreen.tsx     # Driver roster across all shift states (AVAILABLE, ASSIGNED, BREAK)
│       ├── KDSScreen.tsx         # Station health overview, active tickets, SLA warnings
│       ├── CustomersScreen.tsx   # CRM guest lookup, VIP tags, lifetime spend
│       ├── NotificationsScreen.tsx # Actionable push/in-app operational alerts
│       └── SettingsScreen.tsx    # Language toggle (עברית/English), branch info, rush mode
└── App.tsx                       # Root container, navigation bar, provider wrappers
```

---

## 3. Navigation & Screen Hierarchy

The application features a bottom tab bar designed for one-handed thumb reach:

1. **לוח בקרה (Dashboard)**:
   - Primary operational hub.
   - Top operational alert banners (critical driver shortages, KDS SLA breaches).
   - High-contrast live KPI cards: Active Orders, Waiting Deliveries, Available Drivers, KDS Station Health.
2. **הזמנות (Orders)**:
   - Status filtering: `ALL`, `CONFIRMED`, `ACCEPTED`, `IN_PREPARATION`, `READY`, `COMPLETED`.
   - Order inspect card: items, quantities, modifiers, customer name, phone, delivery address, payment status.
   - Domain actions: `Accept`, `Start Preparation`, `Mark Ready`, `Complete`, `Cancel`.
3. **משלוחים (Deliveries)**:
   - **Queue Tab**: Unassigned and in-transit deliveries. Single-click manual driver assignment via modal.
   - **Batches Tab**: Heuristic and batching recommendations with estimated time savings and deterministic manager approval (`Approve` / `Reject`).
4. **שליחים (Drivers)**:
   - Driver roster filtered by state (`AVAILABLE`, `ASSIGNED`, `BREAK`, `ON_SHIFT`).
   - Shows active vehicle, tracker status, time in queue, and direct phone link.
5. **מטבח (KDS)**:
   - Station cards (Burgers, Sides, Drinks, etc.) with queue depth and SLA breach counter.
   - Active ticket inspection without interfering with line cook bump workflows.
6. **לקוחות (Customers)**:
   - Instant search by customer phone number or name.
   - Displays VIP badge, lifetime order count, total spend in ₪, and internal kitchen notes.
7. **התראות (Notifications)**:
   - Real-time in-app feed with actionable deep-link buttons ("Open Delivery #482").
8. **הגדרות (Settings)**:
   - Switch active branch, toggle language (Hebrew RTL / English LTR), enable "Rush Mode" (+20m SLA buffer), pause online orders, and logout.

---

## 4. Authentication & Security Model

- **Staff PIN Keypad**: Fast 4-digit PIN authentication mapped to server-side `POST /api/v1/auth/pin-login`.
- **Brute-Force Protection**: 5 failed PIN attempts lock the terminal for 15 minutes; warning is rendered to the user.
- **Secure Storage**: JWT session token and user profile are persisted via `MobileTokenStorageAdapter`.
- **Granular RBAC**: The UI inspects permissions (`orders.cancel`, `delivery.assign`, `kds.view`, `branches.read`). Server-side `auth-guard.ts` remains the final authority.
- **Clean Logout**: Removes tokens and resets API client headers immediately.

---

## 5. Offline Safety & Resynchronization

In accordance with `docs/CLIENT_ARCHITECTURE.md` (Section 6):
- **Read Operations**: Cached locally (`ro_cache_*`) via `OfflineManager` so managers can view active orders, driver rosters, and menu catalog during Wi-Fi drops.
- **Unsafe Mutations Guard**: Destructive domain actions (e.g. driver assignment, order cancellation, batch approval) are **strictly blocked while offline** (`OFFLINE_MUTATION_BLOCKED`) to prevent state divergence.
- **Visual Alert**: An amber/red `OfflineBanner` alerts the manager when connection drops.
- **Reconnect Reconciliation**: On reconnection, the client automatically invalidates stale caches and fetches authoritative snapshots.

---

## 6. Accessibility & Hebrew RTL Compliance

- **RTL-First**: Configured with `direction: rtl` and flexbox alignment tailored for Israeli restaurant staff.
- **Touch Geometry**: All interactive buttons, tabs, and keypad keys adhere to WCAG 2.1 AA minimum **48dp touch targets**.
- **Color Independence**: Status badges never rely on color alone; every state includes an icon, text label, and border outline.
- **High Contrast**: Dark background (`#090D16`) with high-contrast surfaces (`#111827`, `#1F2937`) for readability under bright kitchen lights.

---

## 7. Build & Running Instructions

### Local Development / Web Preview:
```powershell
cd f:\Developing\Web\ShorTech\RestaurantOS
npm test tests/unit/mobile-manager-app.spec.ts
```

### Expo / Android Device Testing:
```powershell
cd f:\Developing\Web\ShorTech\RestaurantOS\apps\manager-android
npx expo start --android
```
Scan the QR code with the **Expo Go** mobile application on any physical Android phone to test live on hardware.
