# RestaurantOS — Master Testing Strategy & Execution Matrix

**Document ID:** `DOC-TEST-STRAT-001`  
**Version:** `1.1.0`  
**Status:** Approved Canonical Test Strategy  

---

## 1. Master Contract Verification Matrix

| Concept | Domain Model | Database Schema | API Contracts | Event Catalog | Security Boundary | Automated Test Suite |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Order** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `order-state.spec.ts` |
| **Delivery** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `delivery-lifecycle.spec.ts` |
| **Driver** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `driver-shift.spec.ts` |
| **Driver Queue** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `driver-queue.spec.ts` |
| **Vehicle** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `fleet-vehicle.spec.ts` |
| **Tracker** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `tracker-telematics.spec.ts` |
| **Vehicle Location** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `telemetry-ingest.spec.ts` |
| **Vehicle Trip** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `vehicle-trips.spec.ts` |
| **Geofence** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `geofence-engine.spec.ts` |
| **Smart Batch** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `smart-batching.spec.ts` |
| **Campaign** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `campaigns.spec.ts` |
| **Coupon** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `coupons.spec.ts` |
| **Promotion Engine** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `promotion-engine.spec.ts` |
| **Loyalty Program** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `loyalty.spec.ts` |
| **First-Order Logic** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `first-order-logic.spec.ts` |

---

## 2. Domain & Lifecycle Test Suites

### 2.1 Order vs Delivery Independence Test Suite
- `TEST-ORD-001`: Verify that creating a Dine-in or Takeaway order never creates a `Delivery` entity.
- `TEST-ORD-002`: Verify that bumping an order to `READY` in kitchen does not advance delivery state beyond `AVAILABLE_FOR_ASSIGNMENT`.
- `TEST-ORD-003`: Verify that delivery cancellation before pickup does not cancel the kitchen order if customer requested pickup fallback.
- `TEST-ORD-004`: Verify that illegal order state transitions (e.g. `COMPLETED -> IN_PREPARATION`) throw `INVALID_STATE_TRANSITION`.

### 2.2 Driver Availability Queue & Return Semantics Suite
- `TEST-DRV-001`: Deterministic FIFO ordering: Drivers Danny (12:00), Yossi (12:05), and Avi (12:10) return in exact order `[Danny, Yossi, Avi]`.
- `TEST-DRV-002`: Return from break (`DriverReturnedFromBreak`): Driver receives `available_since = NOW()` and moves to the tail of the FIFO queue.
- `TEST-DRV-003`: Physical return to restaurant (`DriverReturnedToRestaurant`): Driver receives `available_since = NOW()` and enters queue tail.
- `TEST-DRV-004`: Manager queue override: Moving driver position records `QueueOverride` with actor, reason, and updates queue immediately without mutating raw historical timestamps.

### 2.3 Fleet Tracking, Telematics & Geofence Suite
- `TEST-FLT-001`: Temporal Driver-Vehicle assignment: Driver A assigned to Vehicle 1, then unassigned; Driver B assigned to Vehicle 1. Querying active driver resolves accurately.
- `TEST-FLT-002`: Temporal Vehicle-Tracker assignment: Tracker X moved from Vehicle 1 to Vehicle 2 without corrupting historical location telemetry.
- `TEST-FLT-003`: Telemetry normalization: `MockTrackerAdapter` transforms vendor payload into canonical `VehicleLocationDTO`.
- `TEST-FLT-004`: Geofence entry: Vehicle coordinates entering customer geofence emits `VehicleEnteredCustomerGeofence` and advances delivery to `ARRIVED_AT_CUSTOMER_AREA`.
- `TEST-FLT-005`: **Telemetry $\neq$ Business Truth Assertion:** Verifies that entering customer geofence **DOES NOT** transition delivery to `DELIVERED`. `DeliveryCompleted` requires explicit driver confirmation.

### 2.4 Marketing, Promotions & Loyalty Engine Suite
- `TEST-MKT-001`: Campaign state machine: Valid transitions `DRAFT -> SCHEDULED -> ACTIVE -> PAUSED -> COMPLETED / CANCELLED`; illegal transitions rejected.
- `TEST-MKT-002`: Coupon validation & redemption: Expiration, activation dates, global limits, customer limits, branch/channel restrictions, and max discount cap.
- `TEST-MKT-003`: Coupon rollback: Order cancellation safely decrements redemption count and restores exhausted status if needed.
- `TEST-MKT-004`: Deterministic rule-based promotion evaluation: Evaluates `IF-THEN` conditions against order context without non-deterministic side effects.
- `TEST-MKT-005`: Promotion conflict resolution: `STACKABLE` accumulates, `EXCLUSIVE` competes by priority, `BEST_DEAL` maximizes discount with max cap enforcement.
- `TEST-MKT-006`: First-order eligibility: Checks customer order history; cancelled/failed orders never disqualify first-order benefits.
- `TEST-MKT-007`: Canonical 3-tier loyalty system: `NEW_CUSTOMER` (לקוח חדש), `REGULAR` (לקוח קבוע), `VIP` (לקוח VIP). Tier progression and demotion on rollback.
- `TEST-MKT-008`: Points accumulation and redemption: Awards points per currency spent, validates redemption balance, prevents negative balance.

---

## 3. High-Concurrency Race Condition Test Suite

| Test Scenario ID | Concurrency Collision Setup | Expected Deterministic Resolution |
| :--- | :--- | :--- |
| `RACE-001` | Drivers Danny and Yossi self-assign Delivery #101 at the identical millisecond. | Exactly ONE driver receives `200 OK (ASSIGNED)`. The second receives `409 Conflict (DELIVERY_ALREADY_ASSIGNED)`. |
| `RACE-002` | Manager assigns Delivery #101 to Avi while Danny attempts self-assignment. | Exactly ONE assignment persists; no split state. |
| `RACE-003` | Driver self-assigns Delivery #101 at the same instant Manager approves a batch containing #101. | The transaction winning the row lock succeeds; the colliding transaction safely fails and rolls back. |
| `RACE-004` | Driver releases Delivery #101 while another driver attempts self-assignment. | Delivery transitions safely to `AVAILABLE_FOR_ASSIGNMENT`, then assigns to claiming driver. |
| `RACE-005` | Driver returns to restaurant while dispatcher is assigning the next FIFO delivery. | Queue recalculation evaluates atomically without phantom driver positions. |

---

## 4. Security & Tenant Boundary Test Suite

- `SEC-ISO-001`: Cross-Tenant Vehicle Query: Tenant A requests `GET /api/v1/fleet/vehicles/:id` for a vehicle belonging to Tenant B $\rightarrow$ `404 Not Found`.
- `SEC-ISO-002`: Cross-Tenant Driver Assignment: Tenant A attempts to assign a driver from Tenant B to a delivery in Tenant A $\rightarrow$ `403 Forbidden (TENANT_BOUNDARY_VIOLATION)`.
- `SEC-ISO-003`: Marketing Tenant Isolation: Coupons, campaigns, promotions, and loyalty accounts from Tenant A are strictly inaccessible to Tenant B $\rightarrow$ `null` / `404 Not Found`.
- `SEC-DTO-001`: Driver Data Minimization: Driver queries `GET /api/v1/deliveries/:id` $\rightarrow$ receives `DeliveryViewDTO` (customer name, masked phone, address, notes) with **zero access** to customer email, billing history, or CRM notes.
- `SEC-WSS-001`: Expired WebSocket Ticket: Attempting WebSocket handshake with an expired (>60s) ticket $\rightarrow$ `401 Unauthorized`.
- `SEC-WSS-002`: Real-Time Channel Guard: Line Cook attempting to subscribe to `branch:<id>:telemetry` $\rightarrow$ subscription rejected.
