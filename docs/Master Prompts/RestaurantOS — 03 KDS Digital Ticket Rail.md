# RestaurantOS — Phase 3: Kitchen Display System

Build the Kitchen Display System (KDS).

The KDS replaces the traditional printed kitchen ticket ("Bon") while maintaining a familiar operational experience.

---

# CORE CONCEPT

Kitchen employees see digital tickets on:

- desktop
- tablet
- Android TV
- Raspberry Pi browser
- commercial display
- future ultra-wide display

Hardware must not be hard-coded into the application.

---

# DIGITAL TICKET

Each ticket displays:

- order number
- time received
- elapsed time
- customer/order type
- items
- quantities
- modifiers
- notes
- allergies where authorized
- priority
- delivery/pickup
- destination/order source

---

# STATUS FLOW

MANDATORY ARCHITECTURAL RULE (PHASE 00 Section 26):
The KDS lifecycle describes food preparation, NEVER delivery or driver movement.
KDS must not use Delivery status as its source of truth.

Canonical KDS Preparation Lifecycle:
- `QUEUED`
- `STARTED`
- `READY`
- `COMPLETED`
(Fallback/Correction: `RECALLED`)

Event-Driven Relationship to Logistics:
When food becomes `READY` (`OrderReady`), an associated delivery order transitions to `AVAILABLE_FOR_ASSIGNMENT`.

---

# INTERACTION

Kitchen employee can:

Start
Complete
Pause where supported
Recall
Mark issue

Large touch-friendly controls.

---

# TIMING & KDS SLA MODEL (PHASE 00 Section 27)

Track:

- queue time
- preparation time
- station time
- total kitchen time

SLA Visualization States:
1. `NORMAL`: Standard header and timer.
2. `NEAR_SLA`: Amber warning tint and icon.
3. `SLA_EXCEEDED`:
   - Full red header
   - White text
   - Very large elapsed timer (e.g., `+00:37`)
   - Warning icon
   - Subtle pulse
   - Must be clearly readable from 1.5–2 meters away.
   - Do NOT introduce decorative animations that reduce operational clarity.

---

# PAPER FALLBACK

Support optional simultaneous paper printing.

This allows gradual transition from paper to digital.

---

# MULTI-STATION

Architecture must support future stations without rewriting the order system.

Examples:

Pizza
Burger
Sushi
Dessert
Packing

---

# REAL-TIME & WEBSOCKET SECURITY (PHASE 00 Sections 28-29)

KDS must update in real time with strict security:

- Authenticate using ephemeral WebSocket connection tickets (`POST /api/v1/realtime/ticket` with 60s TTL; never long-lived tokens in query strings).
- Strict channel authorization boundary: KDS only subscribes to kitchen events for its assigned branch (`kds:{branch_id}`).
- Handle reconnect, duplicate events, stale tickets, browser refresh, and network recovery gracefully.

---

# TESTING

Automated:

- ticket creation
- state transitions
- timers
- real-time updates
- reconnect
- duplicate event handling
- authorization
- tenant isolation
- multi-station routing

E2E:

Order created
→ KDS ticket appears
→ employee starts
→ employee completes
→ order becomes Ready

Manual testing:

Create:

/docs/testing/manual/KDS_MANUAL_TEST.md

Test:

- tablet
- desktop
- narrow screen
- large display
- touch
- mouse
- network disconnect
- refresh
- multiple simultaneous orders
- 100+ tickets
- urgent orders
- delayed orders

Performance target:

KDS must remain usable during peak restaurant load.

Document all assumptions.