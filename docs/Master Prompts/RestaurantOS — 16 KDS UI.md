# RestaurantOS — Prompt 16

## KDS Digital Ticket Rail — Client Implementation

Continue from the existing RestaurantOS repository.

Do NOT rebuild KDS backend/domain/API.

The existing repository already contains:

* KDS module
* stations
* tickets
* start
* ready
* bump
* recall
* KDS stream/realtime API
* ticket state machine
* tests

The missing piece identified during repository audit is the dedicated KDS user-facing client.

---

# 1. Inspect Existing KDS

Read:

* src/modules/kds
* KDS API routes
* KDS realtime stream
* KDS documentation
* KDS master prompt
* relevant schemas
* tests

Determine exact existing contracts.

Do not invent new API contracts if an existing one can be reused.

---

# 2. KDS Client

Create a dedicated KDS route/application surface.

Example:

```text
/kds
/kds/[branchId]
```

Use the repository's existing routing architecture if different.

The UI must work on:

* desktop
* tablet
* Android TV/browser
* Raspberry Pi/browser
* commercial display
* ultrawide display

---

# 3. Ticket Rail

Primary UI:

```text
[ NEW ] [ PREPARING ] [ READY ]

+---------+ +---------+ +---------+
| #482    | | #483    | | #484    |
| 2 Burg. | | Pizza   | | Sushi   |
| 1 Fries | | Salad   | | Drink   |
| 05:21   | | 02:14   | | READY   |
+---------+ +---------+ +---------+
```

Use the existing RestaurantOS visual language.

Do not introduce an unrelated design system.

---

# 4. Ticket Information

Show:

* order number
* items
* modifiers
* quantities
* notes
* source
* timestamps
* elapsed time
* SLA state
* station where applicable

The ticket must be readable from a practical kitchen distance.

---

# 5. SLA Visualization

States:

### Normal

Normal timer.

### Near SLA

Clearly visible warning.

### SLA exceeded

Use the existing required P0 design:

* full red header
* white text
* large timer
* warning icon
* subtle pulse
* extremely obvious urgency

Example:

```text
⚠ SLA EXCEEDED
+00:37
```

Do not rely only on color.

---

# 6. Actions

Touch-friendly:

* Start
* Ready
* Bump
* Recall

Minimum target:

56px touch target.

Support keyboard shortcuts where appropriate:

* F1-F4
* Space
* Enter
* Esc

---

# 7. Realtime

Use existing KDS realtime infrastructure.

Tickets should update without refresh.

Handle:

* reconnect
* missed events
* duplicate events
* stale connection
* resynchronization

The UI must reconcile with server truth.

---

# 8. Ticketed Realtime Security

Use the existing realtime ticket mechanism.

Do not create a permanent unauthenticated WebSocket.

Respect:

* branch
* tenant
* station
* device authorization

---

# 9. Offline/Reconnection

When disconnected:

* clearly show connection status
* keep visible tickets
* do not pretend server state changed
* disable unsafe actions when necessary
* reconnect automatically
* resynchronize

---

# 10. Hardware Independence

Do not hardcode:

* screen dimensions
* mouse
* touchscreen
* keyboard
* specific hardware

The KDS must remain browser/hardware agnostic.

---

# 11. Accessibility

Support:

* keyboard
* touch
* high contrast
* readable fonts
* non-color-only status
* RTL
* Hebrew
* English

---

# 12. Tests

Automated:

* render ticket
* state transition
* realtime event
* duplicate event
* reconnect
* SLA calculation
* overdue visualization
* authorization

E2E:

* receive ticket
* start
* ready
* bump
* recall

Manual:

* 375px
* tablet
* 1080p
* ultrawide
* touchscreen
* keyboard
* reconnect

---

# Definition of Done

A dedicated production-quality KDS UI exists and consumes the existing KDS backend.

Do not modify working backend logic unless an actual client contract gap is discovered.
