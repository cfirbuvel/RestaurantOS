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

New
→ In Preparation
→ Ready

Optional future stations:

Preparation
→ Cooking
→ Assembly
→ Packing
→ Ready

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

# TIMING

Track:

- queue time
- preparation time
- station time
- total kitchen time

Show warning thresholds.

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

# REAL-TIME

KDS must update in real time.

Handle:

- reconnect
- duplicate events
- stale tickets
- browser refresh
- network failure

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