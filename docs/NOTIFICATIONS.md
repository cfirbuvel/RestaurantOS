# RestaurantOS — Master Unified Notifications & Deep Linking Specification

**Document ID:** `DOC-NOTIF-001`  
**Version:** `1.0.0`  
**Phase:** Phase 17 Unified Notifications + Deep Linking  
**Status:** Approved Master Specification  
**Author:** Lead Enterprise Systems Architect  

---

## 1. Architectural Overview & Philosophy

RestaurantOS implements a **Unified, Multi-Client Notification & Deep Linking Architecture** serving all operational surfaces:
- **Web Admin & Backoffice** (`src/app/page.tsx`)
- **Restaurant Manager Mobile App (Android)** (`apps/manager-android`)
- **Driver Mobile App (Android)** (`apps/driver-android`)
- **Kitchen Display System (KDS UI)** (`src/app/kds/[branchId]`)

```text
                  +-----------------------------------+
                  |      Transactional Event Bus      |
                  |     (Order, Delivery, KDS, Hub)   |
                  +-----------------+-----------------+
                                    |
                    [Actionable Anomaly Filter]
                                    |
                  +-----------------v-----------------+
                  |       Notification Service        |
                  |  - Deduplication Sliding Window   |
                  |  - Expiration & TTL Filter        |
                  |  - Strict Tenant/Branch Boundary  |
                  +--------+-----------------+--------+
                           |                 |
                +----------v-------+   +-----v-------------+
                | In-App Store     |   | Push Providers    |
                | (Filtered Query) |   | (FCM/Expo Device) |
                +----------+-------+   +-----+-------------+
                           |                 |
                           +--------+--------+
                                    |
                 Canonical URI: restaurantos://{entity}/{id}
                                    |
         +----------------+---------+---------+----------------+
         |                |                   |                |
    +----v---+      +-----v------+      +-----v------+   +-----v----+
    |  Web   |      |  Manager   |      |   Driver   |   |   KDS    |
    |  Admin |      |  (Android) |      |  (Android) |   | (Station)|
    +--------+      +------------+      +------------+   +----------+
         \                |                   |               /
          +---------------+-------------------+--------------+
                                  |
            [RE-FETCH AUTHORITATIVE CURRENT SERVER STATE]
                     (Push is NEVER Source of Truth)
```

### Core Invariants:
1. **Notifications Represent Actionable Events**: Low-level database mutations or minor state transitions do NOT generate user-facing alerts. Every notification requires human decision or immediate operational awareness.
2. **Push is NOT the Source of Truth**: Push notifications are lightweight wake-up triggers and navigational hints. Upon opening any notification or deep link, the client **must immediately fetch the current authoritative state** from the REST API.
3. **Strict Zero-PII Payload Policy**: Push payloads transmitted through external networks (APNs, FCM, Expo Push) never contain sensitive data (customer PII, payment tokens, credit card details, or supplier margins).

---

## 2. The 10 Actionable Notification Types

| Type | Intended Recipients | Priority | Trigger Condition | Canonical Deep Link |
| :--- | :--- | :--- | :--- | :--- |
| `NEW_DELIVERY_ASSIGNMENT` | Assigned Driver | `HIGH` | Order dispatched and assigned to driver | `restaurantos://delivery/{id}` |
| `DELIVERY_REASSIGNMENT` | Driver, Manager | `HIGH` | Manager reassigns or driver drops delivery | `restaurantos://delivery/{id}` |
| `DELIVERY_OVERDUE` | Manager, Dispatcher | `CRITICAL` | Order exceeds promised delivery SLA | `restaurantos://delivery/{id}` |
| `NO_AVAILABLE_DRIVER` | Manager, Dispatcher | `HIGH` | Orders ready at expo with 0 drivers in queue | `restaurantos://delivery/{id}` |
| `KDS_SLA_BREACH` | Kitchen Manager | `CRITICAL` | Station ticket exceeds preparation threshold | `restaurantos://kds/ticket/{id}` |
| `ORDER_ISSUE` | Floor Manager | `HIGH` | Item cancelled or modification stock conflict | `restaurantos://order/{id}` |
| `PAYMENT_ISSUE` | Cashier, Manager | `CRITICAL` | Payment processing gateway decline/error | `restaurantos://order/{id}` |
| `INTEGRATION_FAILURE` | Admin, Manager | `CRITICAL` | Wolt/10bis external API or webhook failure | `restaurantos://alert/{id}` |
| `SYSTEM_ALERT` | HQ Admin, GM | `CRITICAL` | Thermal printer disconnected or network outage | `restaurantos://alert/{id}` |
| `MANAGER_MESSAGE` | Specific Driver/Staff | `MEDIUM` | Direct broadcast/instruction from manager | `restaurantos://alert/{id}` |

---

## 3. Canonical Notification Payload Envelope

Exported from `src/shared/contracts/notifications.ts`:

```typescript
export interface NotificationEnvelope {
  id: string;               // Unique notification identifier (UUID)
  tenantId: string;         // Multi-tenant organization isolation
  branchId: string;         // Physical branch scope
  recipientId: string;      // User ID, Driver ID, or Role group ('ROLE:MANAGER')
  type: NotificationType;   // One of the 10 actionable types
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp: string;        // ISO 8601 UTC creation timestamp
  title: string;            // Human-readable headline
  body: string;             // Actionable instruction text
  targetEntity: {
    type: "ORDER" | "DELIVERY" | "KDS_TICKET" | "DRIVER" | "ALERT" | "INTEGRATION";
    id: string;             // Entity primary key
  };
  deepLink: string;         // Canonical URI (restaurantos://...)
  read: boolean;            // Read status
  readAt?: string;          // ISO 8601 timestamp when read
  expiresAt?: string;       // ISO 8601 TTL timestamp
  deduplicationKey?: string;// Sliding window deduplication key
  data?: Record<string, any>;// Sanitized contextual metadata
}
```

---

## 4. Deep Linking Architecture & Cross-Platform Routing

All clients share the canonical URI scheme: **`restaurantos://`** parsed by `DeepLinkResolver` (`src/shared/deep-linking/deep-link-resolver.ts`).

### Canonical Routing Matrix

| Canonical URI | Web Admin Equivalent | Manager Android Equivalent | Driver Android Equivalent | KDS Equivalent |
| :--- | :--- | :--- | :--- | :--- |
| `restaurantos://delivery/{id}` | `/?tab=dispatch&deliveryId={id}` | Tab: `deliveries`, Focus: `{id}` | Screen: `delivery`, ID: `{id}` | N/A |
| `restaurantos://order/{id}` | `/?tab=orders&orderId={id}` | Tab: `orders`, Focus: `{id}` | Screen: `queue`, ID: `{id}` | N/A |
| `restaurantos://kds/ticket/{id}` | `/kds/{branchId}?ticketId={id}` | Tab: `kds`, Focus: `{id}` | N/A | Ticket Rail highlight: `{id}` |
| `restaurantos://driver/{id}` | `/?tab=drivers&driverId={id}` | Tab: `drivers`, Focus: `{id}` | Screen: `shift` | N/A |
| `restaurantos://alert/{id}` | `/?tab=notifications&alertId={id}` | Tab: `notifications` | Screen: `notifications` | Modal Alert |

### Deep Link Security & Sanitization
1. **Scheme Validation**: Strictly enforces `restaurantos://`. Malicious external protocols (`javascript:`, `http:`, `file:`) are rejected immediately.
2. **ID Sanitization**: IDs must match `/^[a-zA-Z0-9_-]+$/`. Path traversal (`../`), null-byte injection (`%00`), and script characters are rejected with parse errors.

---

## 5. Reliability, Deduplication & Edge-Case Handling

### 5.1 Deduplication (Sliding Window)
To prevent alert storms when background monitors run periodically (e.g. overdue delivery poller running every 30 seconds):
- Notifications carry an optional `deduplicationKey` (e.g. `overdue:del_123`).
- The `NotificationService` maintains a 5-minute sliding window cache. If an identical key is dispatched within 5 minutes, it is automatically suppressed.

### 5.2 Expired & Stale Notifications
- Each notification may specify an `expiresAt` ISO timestamp (e.g., KDS breach alerts expire after 30 minutes, delivery assignments expire if order completes).
- Queries via `GET /api/v1/notifications` automatically filter out expired notifications so mobile users never act on obsolete events.

### 5.3 Device Token Lifecycle & Revocation
- **Registration**: `POST /api/v1/notifications/device-token` registers mobile device tokens with their platform tag (`ANDROID_MANAGER`, `ANDROID_DRIVER`, `WEB`).
- **Revocation**: `DELETE /api/v1/notifications/device-token?token=...` revokes tokens immediately upon user logout or permission revocation. Push dispatches skip inactive tokens.

### 5.4 Offline Client & App-Not-Running
1. **App in Background / Killed**: Native OS push wakes the application. Tapping the push notification invokes native deep link handler `DeepLinkResolver.resolve(...)`.
2. **Offline Reconnection**: When a client returns online, it calls `GET /api/v1/notifications?unreadOnly=true` to retrieve any unexpired notifications missed during downtime.

---

## 6. REST API Endpoints

1. `GET /api/v1/notifications`:
   - Query Parameters: `limit` (max 100), `unreadOnly` (boolean), `branchId` (UUID), `type` (NotificationType), `priority` (NotificationPriority).
   - Enforces session tenant & recipient isolation.
2. `POST /api/v1/notifications`:
   - Restricted to `OWNER`, `ADMIN`, `MANAGER`, `DELIVERY_MANAGER`, `KITCHEN_MANAGER`.
   - Dispatches actionable notifications across in-app store and active push device tokens.
3. `PATCH /api/v1/notifications/[id]/read`:
   - Atomically marks notification as read for authenticated recipient.
4. `POST /api/v1/notifications/mark-all-read`:
   - Marks all notifications as read for current user/branch.
5. `POST /api/v1/notifications/device-token`:
   - Registers/updates push token.
6. `DELETE /api/v1/notifications/device-token?token=...`:
   - Revokes push device token.
