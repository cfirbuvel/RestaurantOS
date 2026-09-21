# RestaurantOS — Master Multi-Client Architecture & Client Boundaries

**Document ID:** `DOC-ARCH-CLIENT-001`  
**Version:** `1.0.0`  
**Phase:** Phase 13 Multi-Client Architecture & Client Boundary Completion  
**Status:** Approved Master Specification  
**Author:** Lead Enterprise Systems Architect  

---

## 1. Official Conceptual Client Architecture

RestaurantOS is an omnichannel, multi-tenant restaurant operating system serving six distinct canonical client surfaces through unified backend APIs, typed contracts, and ticket-secured real-time event streams:

```text
                               +-----------------------------------+
                               |       RestaurantOS Platform       |
                               +-----------------+-----------------+
                                                 |
                       +-------------------------+-------------------------+
                       |                         |                         |
               REST API Gateway        Ticketed Realtime Gateway    Outbox Domain Events
                       |                         |                         |
       +---------------+---------------+---------+-------+-----------------+
       |               |               |                 |                 |
   Web Admin      Manager App      Driver App         KDS UI             Kiosk
   (Backoffice)     (Android)       (Android)     (Kitchen Rail)      (Self-Service)
       |
  Customer Web
  (Storefront)
```

### The 6 Canonical Clients

1. **Restaurant Web Admin (Backoffice & HQ)**:
   - Configuration, catalog management, inventory supply chain, recipe BOMs, system settings, financial reports, integration hub administration, user access control.
2. **Restaurant Manager Mobile App (Android)** *(Implemented in Prompt 14)*:
   - Live operational monitoring, active order management, delivery dispatch overrides, driver queue oversight, KDS rail overview, real-time operational alerts, quick approvals.
3. **Driver Mobile App (Android)** *(Implemented in Prompt 15)*:
   - Shift check-in/break management, driver availability queue status, assigned delivery navigation, masked customer communication, delivery confirmation, return to restaurant.
4. **Kitchen Display System (KDS UI)** *(Implemented in Prompt 16)*:
   - Digital ticket rail, multi-station routing (Grill, Salad, Fryer, Pizza, Expo), item prep states, SLA timers, touch bump bar actions, audio alerts.
5. **Self-Service Kiosk**:
   - In-store guest self-ordering, interactive menu browsing, product customization, payment terminal EMV handshake, printed/digital order receipt.
6. **Customer Ordering Web (Storefront)**:
   - Responsive public web storefront, menu catalog, shopping cart, online payment clearing, live GPS delivery tracking.

---

## 2. Client Responsibilities & Boundary Matrix

| Dimension | Web Admin | Manager App | Driver App | KDS Client | Kiosk Client | Customer Web |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary User** | Franchise Owner, GM, HQ Admin | Floor Manager, Shift Supervisor | Delivery Driver, Courier | Line Cook, Kitchen Manager | Dining Guest | Web Customer |
| **Platform Target** | Desktop / Tablet Browser | Android Phone / Tablet | Android Smartphone | Touchscreen / Android TV | Large Touchscreen Kiosk | Mobile Web / Desktop |
| **Business Logic** | Server-Side Only | Server-Side Only | Server-Side Only | Server-Side Only | Server-Side Only | Server-Side Only |
| **Local State** | UI session state | Local cache + offline queue | Offline GPS cache | Local rail tickets cache | Transient guest cart | Transient cart session |
| **Authentication** | Bearer JWT / Cookie | Staff Credentials / PIN JWT | Driver PIN / Device Token | Device Activation Token | Kiosk Device Token | Guest / Phone OTP |
| **Realtime Scope** | Full branch & admin | Branch dispatch & alerts | Assigned driver channel | Station tickets channel | None (Stateless) | Order tracking channel |

---

## 3. Client Capability & Authorization Matrix

The matrix below reflects the authoritative server-side RBAC permissions enforced by `auth-guard.ts` and `rbac.ts`:

| Capability | Web Admin | Manager App | Driver App | KDS Client | Kiosk Client | Customer Web |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Authentication** | User / Password / MFA | Staff PIN / Password | Driver PIN / Phone | Device Token | Device / Session | Guest / Phone OTP |
| **Order Creation** | Full POS / Manual | Manual / Phone Intake | None | None | Self-Ordering Only | Online Ordering |
| **Order Lifecycle** | Full State Machine | Full State Machine | None | `IN_PREPARATION` $\rightarrow$ `READY` | Create `DRAFT` / `CONFIRMED` | Create `DRAFT` / `CONFIRMED` |
| **Delivery Management** | Full Dispatch & Override | Batch Approval & Assign | None | None | None | None |
| **Driver Queue** | Full Management | Queue Reordering & Overrides | Self Shift & Availability | None | None | None |
| **Delivery Execution** | Audit & Tracking | Reassign & Status Override | Self Pickup $\rightarrow$ Deliver | None | None | Own Order Tracking |
| **Kitchen Rail** | Admin View & Override | Overview & Expeditor View | None | Station Bump & Recall | None | None |
| **Inventory & BOM** | Full Catalog & Stock Move | Fast Waste & Stock Count | None | None | None | None |
| **Financial & Reports** | Full Z-Report & Audits | Daily Cash / Shift Close | Own Shift Tips / Earnings | None | None | None |
| **System Settings** | Full Tenant & Hardware | Branch Settings Only | None | Station Pairing Only | Terminal Config Only | None |

---

## 4. Server-Side Security Authority & Non-Elevating Metadata

### 4.1 The `X-Client-Type` Header Principle
Clients send the `X-Client-Type` header (`WEB_ADMIN`, `MANAGER_APP`, `DRIVER_APP`, `KDS_UI`, `KIOSK`, `CUSTOMER_WEB`) for contextual routing, analytics, and telemetry.

> [!WARNING]
> **`X-Client-Type` IS NEVER AN AUTHORIZATION BOUNDARY.**  
> A malicious or compromised client sending `X-Client-Type: WEB_ADMIN` or `X-Client-Type: MANAGER_APP` will NOT receive administrative privileges.

### 4.2 Authoritative Authorization Chain
All authorization decisions are derived exclusively on the server from:
1. Validated session token / JWT cryptographically signed by RestaurantOS.
2. The user principal associated with the session.
3. Server-side RBAC role assignment (`Role`) and granular permissions (`Permission`).
4. Server-enforced tenant (`tenant_id`) and branch (`branch_id`) isolation rules.

---

## 5. Idempotency & Retry Protocol

To ensure consistency in unstable restaurant wireless environments, all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) follow deterministic idempotency semantics:

```text
User initiates action -> Client generates Idempotency-Key (UUID)
                               |
                   HTTP POST /api/v1/mutations
                               |
               +---------------+---------------+
               |                               |
       Network Timeout                 200 OK Response
               |                               |
  Client RETRIES with EXACT               Client commits
  SAME Idempotency-Key                    operation
               |
  Server returns CACHED result
  Zero duplicate domain mutations
```

### Protocol Rules:
1. **New Logical Action**: When a user or system initiates a new action (e.g. clicking "Place Order" or "Self-Assign Delivery"), a brand new `Idempotency-Key` is generated.
2. **Network Retry**: When an automated network retry occurs due to socket drops, 502/503/504 gateways, or connection timeouts, **the exact same `Idempotency-Key` is preserved and reused**.
3. **Distinct Action**: If a user abandons an action and explicitly triggers a new one, a fresh `Idempotency-Key` is issued.

---

## 6. Offline Safety Taxonomy

Mobile clients must handle intermittent kitchen or road connectivity without causing conflicting domain states or double-charging customers.

| Classification | Permitted on Reconnect? | Example Operations |
| :--- | :--- | :--- |
| **Safe (Read Operations)** | **YES (Automatic)** | Menu fetching, order status polling, inventory lookups. |
| **Idempotent Sync** | **YES (With Original Key)** | Telemetry GPS ping ingestions, offline clock-in with offline timestamp. |
| **Unsafe Mutations** | **NO (Blocked from Auto-Replay)** | Driver assignment, delivery completion, payment authorizations, stock write-offs. |

> [!CAUTION]
> If an unsafe mutation fails due to network outage, the shared API client fails fast (`OFFLINE_MUTATION_BLOCKED`). It **MUST NEVER** silently queue and replay the operation hours later when connectivity restores, as real-world restaurant conditions will have shifted.

---

## 7. Realtime Ticket Handshake & Snapshot Resynchronization

RestaurantOS enforces a two-step ticketed handshake combined with an authoritative **Snapshot + Event** resynchronization model:

```text
[CLIENT]                                                    [SERVER]
   |                                                           |
   |--- 1. POST /api/v1/realtime/ticket (Session Auth) ------->|
   |<-- 2. 200 OK { ticket: "ws_ticket_xxx" (TTL 60s) } -------|
   |                                                           |
   |--- 3. WS Connect with ?ticket=ws_ticket_xxx ------------->|
   |<-- 4. 101 Switching Protocols ----------------------------|
   |                                                           |
   |--- 5. SUBSCRIBE { channel: "branch:1:kds:grill" } ------->|
   |                                                           |
   |--- 6. GET /api/v1/kds/stations/grill/snapshot ----------->|
   |<-- 7. 200 OK { snapshot: KDSTicket[], sequence: 142 } ----|
   |                                                           |
   |    [Client Reconciles Local State with Snapshot]          |
   |                                                           |
   |<-- 8. Event Stream (TicketCreated, TicketBumped...) ------|
```

### Reconnection Resynchronization Guarantee:
When a socket drops:
1. Client requests a **fresh single-use ticket**.
2. Client reconnects transport.
3. Client re-establishes channel subscriptions.
4. Client requests a **fresh authoritative snapshot** while buffering incoming events.
5. Client reconciles local state with snapshot and applies buffered events in sequence.

---

## 8. Driver Least-Privilege Data Minimization (`DeliveryViewDTO`)

In accordance with security architecture document `DOC-SEC-ARCH-001`, couriers and delivery drivers must never have access to sensitive commercial data or unrelated customer records.

```typescript
export interface DeliveryViewDTO {
  deliveryId: string;
  orderNumber: string;
  destination: {
    street: string;
    houseNumber: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    gateCode?: string;
    parkingInstructions?: string;
    deliveryNotes?: string;
    location: { lat: number; lng: number };
  };
  customerContact: {
    displayName: string;
    maskedPhone: string; // Relayed through proxy
  };
  deliveryStatus: DeliveryStatus;
  itemsSummary: Array<{ name: string; quantity: number }>;
  isPaid: boolean;
  amountToCollectOnDelivery: number; // 0.00 if already paid
}
```

**Restricted from Driver Views**:
- Full customer order history and lifetime spend.
- Raw customer phone numbers (masked/proxied).
- Internal food cost margins and recipe BOM details.
- Kitchen preparation station breakdowns.
- Details, assignments, or locations of other drivers.

---

## 9. Future Native Client Portability (Prompts 14–16)

All shared client code in `src/shared/`:
- Has **zero dependencies on browser DOM APIs** (`window`, `document`, `localStorage`).
- Employs pluggable storage (`IStorageAdapter`) and transport (`IRealtimeTransport`).
- Directly imports into future React Native / Kotlin Android applications for Prompt 14 (Manager App), Prompt 15 (Driver App), and Prompt 16 (Dedicated KDS UI) without database or contract refactoring.
