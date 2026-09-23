# RestaurantOS — KDS Digital Ticket Rail (Client Implementation)

**Document ID:** `DOC-KDS-UI-001`  
**Phase:** 16  
**Status:** `COMPLETED & VERIFIED`

---

## 1. Overview & Architecture

The Kitchen Display System (KDS) Digital Ticket Rail is a dedicated, production-grade web client designed specifically for commercial kitchen environments, displays, and embedded hardware:
- Desktop PCs & Touch All-in-Ones (ELO, Posiflex, Partner Tech)
- Wall-mounted Android TVs & Fire TV sticks (using native browsers)
- Raspberry Pi & Linux embedded display boards (Chromium kiosk mode)
- Ultrawide commercial monitors (21:9 / 32:9) & vertical displays

The KDS client connects to the existing RestaurantOS backend without rebuilding domain contracts or APIs.

```text
[ Browser / Kiosk Display ]
   │
   ├── 1. Fast PIN Keypad Auth ───────► POST /api/v1/auth/pin-login
   │
   ├── 2. Ephemeral Ticket Token ─────► POST /api/v1/realtime/ticket (TTL: 60s)
   │
   ├── 3. EventSource Stream ─────────► GET /api/v1/kds/stream?ticket=tk_xxx (SSE)
   │      (Listens to KDSTicketCreated, Started, Ready, Bumped, Recalled)
   │
   ├── 4. Action Commands ────────────► POST /api/v1/kds/tickets/:id/{start|ready|bump|recall}
   │      (Optimistic state update + rollback on error)
   │
   └── 5. Live SLA Clock ─────────────► Local 1s ticker running computeKDSSLA()
```

---

## 2. Realtime SSE Stream & Ephemeral Ticket Security

To prevent permanent, unauthenticated WebSocket connections and protect multi-tenant isolation:
1. **Ephemeral Ticket Handshake (Phase 00 Section 28)**:
   - The client calls `POST /api/v1/realtime/ticket` with `{ branchId, stationId }`.
   - The backend validates session permissions (`kds.view`) and issues a cryptographically secure token with a 60-second TTL.
   - The token is atomically consumed upon establishing the SSE connection at `GET /api/v1/kds/stream?ticket=...`. A consumed token cannot be reused.
2. **Domain Event Bus Bridge**:
   - The stream handler subscribes to five authoritative domain events on `eventBus`:
     - `KDSTicketCreated`
     - `KDSTicketStarted`
     - `KDSTicketReady`
     - `KDSTicketBumped`
     - `KDSTicketRecalled`
   - Events are filtered by `tenantId`, `branchId`, and optional `stationId`.
   - On connection abort (`req.signal`), all listeners are cleanly unsubscribed using `eventBus.unsubscribe()`, preventing memory leaks.
3. **Zero Customer PII**:
   - Tickets streamed or rendered on KDS screens contain strictly operational data: order number, items, quantities, modifiers, cook notes, station name, and elapsed preparation timers. No customer names, phone numbers, delivery addresses, or payment details are sent.

---

## 3. SLA Visualization & Kitchen Urgency Spec

The KDS client implements the mandatory P0 SLA visualization hierarchy defined in Phase 00 Section 27:

| SLA State | Condition | Visual Design | Audio Alert |
| :--- | :--- | :--- | :--- |
| **NORMAL** | 0% to 75% of target time (e.g. 0 to 11m 15s) | Dark neutral slate header, white timer badge, counting down `MM:SS`. | None |
| **NEAR_SLA** | 75% to 100% of target time (e.g. 11m 15s to 15m) | Vibrant amber header, warning icon, remaining time countdown `MM:SS`. | None |
| **SLA_EXCEEDED** | > 100% of target time (> 15m) | **Full red header**, white bold text, `⚠️ חריגת SLA` label, large monospace timer showing overtime `+MM:SS` (e.g. `+00:37`), continuous subtle pulse animation (`animate-pulse`). | Synthesized dual-tone acoustic pulse (toggleable) |

---

## 4. Kitchen Ergonomics & Touch Target Standards

Kitchen workers operate with wet, gloved, or greasy hands under fast-paced conditions:
- **Touch Targets**: All action buttons implement `.touch-target-kds` (min-height 64px) with high contrast text and large icons.
- **Three-Column Status Rail**:
  - `[ NEW / QUEUED ]` — Freshly placed orders waiting to be started.
  - `[ PREPARING / STARTED ]` — Active orders currently being cooked on the line.
  - `[ READY ]` — Finished dishes ready for expediting/pickup.
- **Recall Drawer**: Bumping a ticket moves it to `COMPLETED` and removes it from the rail. A dedicated **"Recall / Recently Bumped"** modal allows staff to inspect recently closed tickets and restore them to the active rail with 1 click.

---

## 5. Physical Keyboard & Bump Bar Shortcuts

For commercial kitchens equipped with bump bars (Logic Controls KB1700, MicroTouch) or standard USB/Bluetooth keyboards:

| Key Shortcut | Action | Scope |
| :--- | :--- | :--- |
| **`F1`** | **Start Ticket** (`QUEUED` ➔ `STARTED`) | Focused ticket, or first ticket in `QUEUED` column |
| **`F2`** | **Ready Ticket** (`STARTED` ➔ `READY`) | Focused ticket, or first ticket in `STARTED` column |
| **`F3`** | **Bump Ticket** (`READY` ➔ `COMPLETED`) | Focused ticket, or first ticket in `READY` column |
| **`F4`** | **Recall Last** | Restores the most recently bumped ticket |
| **`Space` / `Enter`** | **Primary Action** | Executes the natural next state transition for the focused card |
| **`Esc`** | **Deselect** | Clears focus from active ticket card |
| **`←` `→` `↑` `↓`** | **Navigate Cards** | Shifts focus outline between visible ticket cards |

---

## 6. Offline Behavior & Network Resilience

When network drops or temporary Wi-Fi dead zones occur in the kitchen:
1. **Persistent Cache**: Active tickets remain visible on the screen. The display never goes blank.
2. **Reconnecting Banner**: A high-visibility banner indicates connection loss and attempts exponential backoff reconnection (`1s ➔ 2s ➔ 4s ➔ 8s ➔ 16s ➔ max 30s`).
3. **Safety Interlocks**: Potentially destructive actions are guarded during complete offline state to avoid database desynchronization.
4. **Automatic Resync**: Upon reconnection, a fresh ephemeral ticket is acquired, initial state is refreshed, and any missed tickets are merged.
5. **Fallback Polling**: A periodic 12-second REST polling fallback ensures reconciliation even on low-spec browsers that terminate SSE streams.

---

## 7. Sound / Acoustic Alerts (Web Audio API)

Kitchen staff cannot stare at the screen continuously:
- **New Ticket Chime**: Ascending two-tone chime (587 Hz ➔ 880 Hz, D5 to A5) when a new ticket is routed to the station.
- **SLA Alert Chime**: Warning pulse when any ticket exceeds 100% of its target SLA.
- Synthesized entirely via standard browser `AudioContext` — requires zero external audio assets.
- **Mute Toggle**: Easily toggleable in the top status bar; preference is persisted in `localStorage`.

---

## 8. Verification & Test Coverage

The KDS client implementation is verified by both unit and integration test suites:
- `tests/unit/kds-ui.spec.ts`: Tests SLA mathematical edge cases, overtime formatting, state machine transition validity, and exponential backoff progression.
- `tests/integration/kds-e2e.spec.ts`: Tests complete REST route lifecycle (`start`, `ready`, `bump`, `recall`), SSE stream connection via single-use ticket, live event emission through `eventBus`, listener cleanup on stream abort, and station authorization boundaries.
- **Test Results**: All 364 tests across 50 test files in the repository pass.
