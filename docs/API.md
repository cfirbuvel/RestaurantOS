# RestaurantOS — Master API Specification & Contract Standards

**Document ID:** `DOC-API-001`  
**Version:** `1.1.0`  
**Status:** Approved Canonical API Contract  
**Protocols:** REST (HTTP/2 & HTTP/1.1), WebSockets (RFC 6455), Server-Sent Events (SSE)  

---

## 1. API Architecture Principles & Conventions

1. **Base URL:** `/api/v1`
2. **Data Format:** `application/json; charset=utf-8`
3. **Authentication:** Bearer JWT in Authorization header or HTTP-Only Secure Session Cookie (`restaurantos_session`).
4. **Tenant Context Headers:**
   - `X-Tenant-ID`: UUID representing the active Organization / Tenant.
   - `X-Branch-ID`: UUID representing the active Branch location.
5. **Idempotency:** All state-mutating requests (`POST`, `PUT`, `PATCH`) support the `Idempotency-Key: <UUID>` header to prevent duplicate execution during network retries.

---

## 2. Response Envelopes & Error Protocols

### 2.1 Single Resource / Command Action Envelope
*Single resource queries and command actions omit pagination objects:*
```json
{
  "success": true,
  "data": {
    "deliveryId": "del_01J8XK9R...",
    "status": "ASSIGNED",
    "driverId": "drv_01J8XK8P...",
    "assignedAt": "2026-09-12T15:30:00Z"
  },
  "meta": {
    "requestId": "req_01HP89XJ...",
    "timestamp": "2026-09-12T15:30:00Z"
  }
}
```

### 2.2 List / Collection Resource Envelope
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalItems": 142,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "meta": {
    "requestId": "req_01HP89XJ...",
    "timestamp": "2026-09-12T15:30:00Z"
  }
}
```

### 2.3 RFC 7807 Error Response
```json
{
  "success": false,
  "error": {
    "code": "DELIVERY_ALREADY_ASSIGNED",
    "message": "The specified delivery has already been assigned to another driver.",
    "details": [
      {
        "field": "deliveryId",
        "issue": "Status is ASSIGNED (driverId: drv_881)"
      }
    ],
    "requestId": "req_01HP89XJ...",
    "timestamp": "2026-09-12T15:30:00Z"
  }
}
```

---

## 3. Explicit Domain Commands Reference

### 3.1 Universal Order Domain Commands
| Endpoint | Method | Scope / Permission | Valid Source States | Result State | Emitted Event |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/orders` | `POST` | `orders:create` | None (New) | `DRAFT` / `CONFIRMED` | `OrderCreated` |
| `/api/v1/orders/:id/confirm` | `POST` | `orders:update` | `DRAFT` | `CONFIRMED` | `OrderConfirmed` |
| `/api/v1/orders/:id/accept` | `POST` | `orders:update` | `CONFIRMED` | `ACCEPTED` | `OrderAccepted` |
| `/api/v1/orders/:id/start-preparation` | `POST` | `kds:update` | `ACCEPTED` | `IN_PREPARATION` | `OrderPreparationStarted` |
| `/api/v1/orders/:id/ready` | `POST` | `kds:update` | `IN_PREPARATION` | `READY` | `OrderReady` |
| `/api/v1/orders/:id/complete` | `POST` | `orders:complete` | `READY` | `COMPLETED` | `OrderCompleted` |
| `/api/v1/orders/:id/cancel` | `POST` | `orders:cancel` | `DRAFT`, `CONFIRMED`, `ACCEPTED`, `IN_PREPARATION` | `CANCELLED` | `OrderCancelled` |

---

### 3.2 Delivery Logistics Domain Commands
| Endpoint | Method | Scope / Permission | Valid Source States | Result State | Emitted Event |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/deliveries/:id/assign` | `POST` | `delivery:manage` | `READY`, `AVAILABLE_FOR_ASSIGNMENT` | `ASSIGNED` | `DeliveryAssigned` |
| `/api/v1/deliveries/:id/self-assign` | `POST` | `delivery:self_assign` | `AVAILABLE_FOR_ASSIGNMENT` | `ASSIGNED` | `DeliverySelfAssigned` |
| `/api/v1/deliveries/:id/release` | `POST` | `delivery:release` | `ASSIGNED` (before pickup) | `AVAILABLE_FOR_ASSIGNMENT` | `DeliveryReleased` |
| `/api/v1/deliveries/:id/pickup` | `POST` | `driver:operate` | `ASSIGNED` | `PICKED_UP` | `DeliveryPickedUp` |
| `/api/v1/deliveries/:id/start` | `POST` | `driver:operate` | `PICKED_UP` | `OUT_FOR_DELIVERY` | `DeliveryDispatched` |
| `/api/v1/deliveries/:id/arrive` | `POST` | `driver:operate` | `OUT_FOR_DELIVERY` | `ARRIVED_AT_CUSTOMER_AREA` | `DeliveryArrivedAtCustomerArea` |
| `/api/v1/deliveries/:id/complete` | `POST` | `driver:operate` | `OUT_FOR_DELIVERY`, `ARRIVED_AT_CUSTOMER_AREA` | `DELIVERED` | `DeliveryCompleted` |
| `/api/v1/deliveries/:id/fail` | `POST` | `driver:operate` | `OUT_FOR_DELIVERY`, `ARRIVED_AT_CUSTOMER_AREA` | `FAILED` | `DeliveryFailed` |
| `/api/v1/deliveries/:id/cancel` | `POST` | `delivery:manage` | `WAITING`, `PREPARING`, `READY`, `ASSIGNED` | `CANCELLED` | `DeliveryCancelled` |

---

### 3.3 Driver Shift & Queue Commands
| Endpoint | Method | Scope / Permission | Description & State Transition | Emitted Event |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/drivers/me/clock-in` | `POST` | `driver:operate` | Shift: `ON_SHIFT`, Assignment: `AVAILABLE`, sets `available_since = NOW()` | `DriverClockedIn`, `DriverEnteredQueue` |
| `/api/v1/drivers/me/break` | `POST` | `driver:operate` | Shift: `BREAK`, removed from eligible FIFO assignment queue | `DriverWentOnBreak`, `DriverLeftQueue` |
| `/api/v1/drivers/me/return-from-break` | `POST` | `driver:operate` | Shift: `ON_SHIFT`, Assignment: `AVAILABLE`, resets `available_since = NOW()` | `DriverReturnedFromBreak`, `DriverEnteredQueue` |
| `/api/v1/drivers/me/arrived-at-restaurant`| `POST` | `driver:operate` | Trip: `NOT_STARTED`, Assignment: `AVAILABLE`, resets `available_since = NOW()` | `DriverReturnedToRestaurant`, `DriverEnteredQueue` |
| `/api/v1/drivers/me/clock-out` | `POST` | `driver:operate` | Shift: `OFF_SHIFT`, removed from all queues | `DriverClockedOut`, `DriverLeftQueue` |
| `/api/v1/deliveries/queue` | `GET` | `delivery:read` | Returns active FIFO Driver Availability Queue ordered by `available_since ASC` | None |

---

### 3.4 Fleet & Telematics Management
| Endpoint | Method | Scope / Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/fleet/vehicles` | `GET` | `fleet:read` | List branch vehicles and operational status. |
| `/api/v1/fleet/driver-assignments` | `POST` | `fleet:manage` | Temporarily assign driver to vehicle (`DriverVehicleAssignment`). |
| `/api/v1/fleet/tracker-assignments`| `POST` | `fleet:manage` | Mount tracker on vehicle (`VehicleTrackerAssignment`). |
| `/api/v1/telemetry/location` | `POST` | `telemetry:ingest`| Ingest GPS location telemetry packet from IoT tracker adapter. |

---

### 3.5 Delivery Smart Batching Endpoints
| Endpoint | Method | Scope / Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/deliveries/batches/suggest` | `POST` | `delivery:batch` | Calculate heuristic delivery batches awaiting manager review. |
| `/api/v1/deliveries/batches/:id/approve` | `POST` | `delivery:manage` | Manager approves batch; transitions to `APPROVED`. |
| `/api/v1/deliveries/batches/:id/reject` | `POST` | `delivery:manage` | Manager rejects batch with reason; transitions to `REJECTED`. |

---

## 4. Real-Time Streaming & Ticket-Based WebSocket Protocol

### 4.1 Connection Ticket Handshake (`POST /api/v1/realtime/ticket`)
To protect session tokens, clients obtain an ephemeral (60s), single-use connection ticket:
```http
POST /api/v1/realtime/ticket
Authorization: Bearer <session_jwt>
X-Tenant-ID: org_550e8400...
X-Branch-ID: brn_770e8400...

HTTP/1.1 200 OK
{
  "success": true,
  "data": {
    "ticket": "ws_ticket_99182301...",
    "expiresAt": "2026-09-12T15:31:00Z"
  }
}
```

### 4.2 WebSocket Connection Handshake
```http
GET /api/v1/realtime?ticket=ws_ticket_99182301...
Host: api.restaurantos.io
Upgrade: websocket
Connection: Upgrade
```

### 4.3 Channel Security & Authorization Boundaries
| Channel Pattern | Allowed Roles | Data Payload Security Standard |
| :--- | :--- | :--- |
| `branch:<id>:kds:<station>` | Cook, Kitchen Manager | Kitchen items, modifiers, order number. **Zero customer PII.** |
| `branch:<id>:dispatch` | Dispatcher, General Manager | Active orders, driver positions, batch suggestions, SLA timers. |
| `driver:<id>:deliveries` | Authenticated Driver | `DeliveryViewDTO` (address, entrance, notes, masked customer name). |
| `order:<id>:tracking` | Public (Anonymized) | Live delivery stage, anonymized vehicle coordinates (no driver phone/PII). |
| `branch:<id>:telemetry` | Fleet Manager | Raw vehicle GPS telemetry, speed, battery levels. |
