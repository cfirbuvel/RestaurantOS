# Driver App — Backend API Audit

**Phase:** 15 — Driver Android Application  
**Author:** Auto-generated during Phase 15 planning  
**Date:** 2026-09-22

This document audits all existing backend endpoints relevant to the Driver Android app. No new business logic is introduced; this audit confirms what can be consumed by the client before any code is written.

---

## 1. Authentication

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| `POST` | `/api/v1/auth/login` | No | Email + password login → returns `{ session: { token, userId, role, permissions }, user }` |
| `POST` | `/api/v1/auth/logout` | Yes | Invalidates session token |
| `POST` | `/api/v1/auth/pin-login` | No | PIN-only login (manager shortcut) — **not used for driver app initial login** |

**Driver app flow:** `POST /auth/login` → receive JWT → store in SecureStore → local PIN setup for subsequent unlocks.

---

## 2. Driver Shift Management (`/api/v1/drivers/me/...`)

All endpoints below require a valid JWT session with `delivery.write` or equivalent driver permission.

| Method | Path | Description | Domain Event |
|--------|------|-------------|-------------|
| `POST` | `/api/v1/drivers/me/clock-in` | Start shift, join FIFO queue at `available_since = NOW()` | `DRIVER_CLOCKED_IN` |
| `POST` | `/api/v1/drivers/me/clock-out` | End shift, removed from queue | `DRIVER_CLOCKED_OUT` |
| `POST` | `/api/v1/drivers/me/break` | Pause shift, removed from FIFO queue | `DRIVER_WENT_ON_BREAK` |
| `POST` | `/api/v1/drivers/me/return-from-break` | Resume shift, rejoins end of FIFO queue | `DRIVER_RETURNED_FROM_BREAK` |
| `POST` | `/api/v1/drivers/me/arrived-at-restaurant` | Mark physical return to branch after delivery, rejoins queue | `DRIVER_RETURNED_TO_RESTAURANT` |

**Gap identified:** `GET /api/v1/drivers/me` does **not** exist yet. This is needed by the app to load the driver's current `ShiftStatus`, `AssignmentStatus`, and `TripStatus` on startup. → Created in Phase 15.1.

### Shift State Machine

```
OFF_SHIFT  ──clock-in──►  ON_SHIFT  ──break──►  BREAK
                │                                    │
            clock-out                      return-from-break
                │                                    │
            OFF_SHIFT  ◄────────────────────────  ON_SHIFT
```

### Driver Record Shape (DriverRecord)

```typescript
{
  id: string;                  // "drv_..."
  tenant_id: string;
  branch_id: string;
  user_id: string;
  shift_status: "OFF_SHIFT" | "ON_SHIFT" | "BREAK";
  assignment_status: "AVAILABLE" | "ASSIGNED";
  trip_status: "NOT_STARTED" | "IN_TRANSIT" | "AT_CUSTOMER" | "RETURNING";
  available_since: Date | null; // FIFO queue position — null when not available
  is_active: boolean;
  can_self_assign: boolean;
  can_self_batch: boolean;
}
```

---

## 3. Delivery Queue & Available Deliveries

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/deliveries?status=AVAILABLE_FOR_ASSIGNMENT` | Yes (`delivery.read`) | Returns list of unassigned deliveries eligible for self-assignment (minimized `DeliveryViewDTO` for driver role). |
| `GET` | `/api/v1/deliveries/queue` | Yes (`delivery.read`) | Returns FIFO-ordered list of active drivers waiting for assignments (`DriverQueueEntry[]`). |
| `GET` | `/api/v1/deliveries` | Yes (`delivery.read`) | Full delivery list with filters (`status`, `branchId`, `driverId`). |
| `GET` | `/api/v1/deliveries/:id` | Yes (`delivery.read`) | Single delivery detail. |

### Delivery Record (key fields for driver)

```typescript
{
  id: string;
  status: DeliveryStatus;      // see lifecycle below
  order_id: string;
  order: { order_number, items_summary, notes, payment_status };
  customer: { first_name, phone };          // privacy-scoped
  delivery_address: {
    street, houseNumber, entrance, floor, apartment,
    city, gateCode, parkingInstructions, deliveryNotes,
    latitude, longitude
  };
  driver_id: string | null;
  assigned_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
}
```

---

## 4. Delivery Lifecycle Actions (`/api/v1/deliveries/:id/...`)

All require JWT + `delivery.self_assign` or `delivery.write` permission.

| Method | Path | Body | Description | HTTP on conflict |
|--------|------|------|-------------|-----------------|
| `POST` | `/deliveries/:id/self-assign` | — | Atomic self-assignment (race-safe). | `409` with `DELIVERY_ALREADY_ASSIGNED` |
| `POST` | `/deliveries/:id/start` | — | Driver picks up order from kitchen | `400` on invalid state |
| `POST` | `/deliveries/:id/pickup` | — | Driver confirms package collected | `400` |
| `POST` | `/deliveries/:id/arrive` | — | Driver marks arrival at customer area | `400` |
| `POST` | `/deliveries/:id/complete` | — | Delivery confirmed completed | `400` |
| `POST` | `/deliveries/:id/release` | — | Driver releases assignment (voluntary) | `400` |
| `POST` | `/deliveries/:id/cancel` | `{ reason }` | Cancel delivery (manager-level) | `400` |

### Delivery Status Lifecycle

```
WAITING ──► PREPARING ──► READY ──► AVAILABLE_FOR_ASSIGNMENT
                                          │
                                     self-assign
                                          │
                                       ASSIGNED
                                          │
                                        start
                                          │
                                      PICKED_UP
                                          │
                                        pickup
                                          │
                                   OUT_FOR_DELIVERY
                                          │
                                        arrive
                                          │
                               ARRIVED_AT_CUSTOMER_AREA
                                          │
                                       complete
                                          │
                                       DELIVERED
```

---

## 5. Fleet / Telemetry

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/telemetry/location` | Yes (`telemetry.ingest`) | Ingest GPS location telemetry packet. |
| `GET` | `/api/v1/fleet` | Yes (`fleet.read`) | Fleet vehicle / tracker list (manager use). |

**Driver app usage:** Post a **single one-shot GPS fix** at `/arrive` and optionally at `/complete` (best-effort, non-blocking). Never continuous background polling.

---

## 6. Realtime (SSE)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/realtime` | Yes | Server-Sent Events stream for the authenticated tenant/branch. |

**Relevant events for driver app:**

| Event | Payload | Action |
|-------|---------|--------|
| `delivery.assigned` | `{ deliveryId, driverId }` | Refresh current delivery if driverId matches |
| `delivery.updated` | `{ deliveryId, status }` | Refresh delivery card |
| `driver.status_changed` | `{ driverId, shiftStatus, assignmentStatus }` | Refresh home screen state |
| `order.ready` | `{ orderId }` | Alert driver delivery is ready for pickup |

---

## 7. Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/notifications/device-token` | Yes | Register push notification device token |
| `GET` | `/api/v1/notifications` | Yes | Fetch notification inbox |

---

## 8. Summary of Gaps

| # | Gap | Resolution |
|---|-----|-----------|
| 1 | `GET /api/v1/drivers/me` — driver own record does not exist | **Created in Phase 15.1** |

All other required endpoints already exist. No delivery business logic is duplicated in the app.
