# RestaurantOS — Phase 4: Delivery, Driver Queue, Fleet Tracking & Smart Batching

Build the complete delivery management, driver availability queue, fleet tracking, and smart batching module.

IMPORTANT:

Generation 1 is HUMAN OPERATED.

The system may recommend delivery batches and assignments, but a human manager must approve them.

Do NOT allow autonomous AI decisions in Generation 1.

---

# DELIVERY MANAGEMENT (PHASE 00 Section 4)

Implement:

- delivery orders (decoupled from Universal Orders)
- delivery zones
- addresses
- drivers & vehicles
- driver availability queue (`available_since ASC`)
- driver multidimensional state
- driver assignment & self-assignment
- delivery batches
- dispatch
- delivery status
- estimated delivery time
- SLA tracking
- delivery history & decision logs

---

# DRIVER MULTIDIMENSIONAL STATE MODEL (PHASE 00 Section 6)

Do NOT encode unrelated concepts into one giant enum. Separate these conceptual dimensions:

## 1. Shift Status
- `OFF_SHIFT`
- `ON_SHIFT`
- `BREAK`

## 2. Assignment Status
- `AVAILABLE`
- `ASSIGNED`

## 3. Trip Status
- `NOT_STARTED`
- `IN_TRANSIT`
- `AT_CUSTOMER`
- `RETURNING`

---

# DRIVER AVAILABILITY QUEUE & RETURN SEMANTICS (PHASE 00 Sections 7 & 8)

- Queue priority is strictly derived from `available_since ASC`.
- Never store queue position as the primary source of truth.
- Disambiguate return events:
  - `POST /drivers/me/return-from-break` emits `DriverReturnedFromBreak`.
  - `POST /drivers/me/arrived-at-restaurant` emits `DriverReturnedToRestaurant`.
  These are distinct domain events and must never be treated as the same event.

---

# CANONICAL DELIVERY LIFECYCLE (PHASE 00 Section 4)

Independent delivery state machine:

- `WAITING`
- `PREPARING`
- `READY`
- `AVAILABLE_FOR_ASSIGNMENT`
- `ASSIGNED`
- `PICKED_UP`
- `OUT_FOR_DELIVERY`
- `ARRIVED_AT_CUSTOMER_AREA`
- `DELIVERED`
Terminal Failure/Abort:
- `FAILED`
- `CANCELLED`

Crucial Release Rule:
When a delivery is released before pickup (`POST /deliveries/:id/release`), it returns to `AVAILABLE_FOR_ASSIGNMENT`.

---

# DELIVERY DOMAIN COMMANDS (PHASE 00 Section 5)

Replace generic CRUD status mutations (`PATCH /deliveries/:id/status`) with explicit domain commands:

- `POST /deliveries/:id/assign`
- `POST /deliveries/:id/self-assign`
- `POST /deliveries/:id/release`
- `POST /deliveries/:id/pickup`
- `POST /deliveries/:id/start`
- `POST /deliveries/:id/arrive`
- `POST /deliveries/:id/complete`
- `POST /deliveries/:id/fail`
- `POST /deliveries/:id/cancel`

All assignment operations must be atomic, tenant/branch scoped, race-condition safe, and audited.

---

# DRIVER SELF-ASSIGNMENT (PHASE 00 Section 9)

- Per-driver permission configurable by manager.
- Atomic assignment where only one driver can claim an eligible delivery.
- Audit assignment source: `MANAGER`, `DRIVER_SELF_ASSIGN`, `SYSTEM_RECOMMENDATION`.

---

# FLEET TRACKING & TELEMATICS DOMAIN (PHASE 00 Sections 14-25 & ADR 0009)

1. **Vehicle as First-Class Domain:** `id`, `tenant_id`, `branch_id`, `vehicle_type` (`BIKE`, `SCOOTER`, `SMALL_CAR`, `MEDIUM_CAR`, `LARGE_VAN`, `TRUCK`), `license_plate`, `capacity`, `status`.
2. **Driver ↔ Vehicle Assignment:** Temporal relation `DriverVehicleAssignment` (`driver_id`, `vehicle_id`, `assigned_at`, `unassigned_at`).
3. **Tracker as First-Class Domain:** IoT device representation `Tracker` (`id`, `provider`, `external_device_id`, `battery_level`, `status`).
4. **Vehicle ↔ Tracker Assignment:** Temporal relation `VehicleTrackerAssignment`.
5. **VehicleLocation & Trips:**
   - Partitioned `vehicle_locations` table (`recorded_at` vs `received_at`, coordinates, speed, heading).
   - `vehicle_trips` linking vehicle movement to an optional delivery.
6. **Geofencing:** Branch and customer geofences emitting `VehicleEnteredRestaurantGeofence`, `VehicleExitedRestaurantGeofence`, `VehicleEnteredCustomerGeofence`, etc.
7. **Primary vs Secondary Tracking (PHASE 00 Section 19):**
   - GPS + Cellular/LTE is primary operational fleet tracking.
   - AirTag/Find My devices are secondary anti-theft only; never primary operational telemetry.
8. **CORE ARCHITECTURAL RULE — TELEMETRY $\neq$ BUSINESS TRUTH (PHASE 00 Section 23):**
   - `VehicleEnteredCustomerGeofence` triggers `ARRIVED_AT_CUSTOMER_AREA`.
   - Telemetry GPS arrival must NEVER automatically trigger `DELIVERED` without driver/human confirmation! Delivery completion remains a business workflow event.

---

# SMART BATCHING

Create a deterministic Delivery Optimization Engine.

Potential inputs:

- destination distance
- route direction
- angular deviation
- estimated travel time
- kitchen workload
- preparation time
- driver availability
- promised delivery time
- order age
- order priority
- current ready orders
- expected completion time
- maximum waiting time
- delivery zone
- restaurant configuration

---

# IMPORTANT

Distance alone must NEVER determine batching.

Two destinations may be geographically close but operationally bad if they require opposite directions.

Therefore evaluate:

Distance
+
Route similarity
+
Direction alignment
+
Travel time
+
SLA impact
+
Kitchen timing
+
Driver availability

---

# BATCH SCORING

Create a deterministic scoring model.

Example:

BatchScore =
DistanceScore
+ DirectionScore
+ PreparationAlignment
+ DriverAvailability
+ KitchenLoad
+ SLACompatibility
+ HistoricalSuccess

The exact weighting must be configurable.

Do not hard-code restaurant-specific assumptions.

---

# MANAGER APPROVAL

When a batch is suggested:

Display:

Orders
Distance
Direction
Estimated preparation
Estimated delivery
SLA impact
Driver
Score
Reasoning

Buttons:

APPROVE
REJECT
MODIFY
FORCE

---

# DECISION LOG

Every recommendation must be recorded.

Store:

- candidate orders
- available drivers
- kitchen state
- relevant metrics
- recommendation
- score
- manager decision
- rejection reason
- modification
- final outcome

---

# LEARNING DATA

Create a structured dataset from decisions.

The system must learn from:

Manager Approved
Manager Rejected
Manager Modified
Manager Forced

And especially:

What happened after the decision.

Track:

- actual preparation time
- actual travel time
- actual delivery time
- SLA success
- customer outcome
- batch success
- driver efficiency

---

# AI LEARNING FOUNDATION

Create interfaces for future:

PredictionEngine
LearningEngine
RecommendationEngine
DecisionEngine
AutomationPolicyEngine

DO NOT introduce an LLM dependency into the critical delivery workflow.

---

# FUTURE AI

Architecture must support:

Generation 2:
ML-based predictions

Generation 3:
AI Copilot

Generation 4:
Agentic Delivery Optimization

---

# AUTOMATION LEVEL

Implement configuration:

Level 0:
Manual only

Level 1:
Rule-based suggestions

Level 2:
Smart recommendations

Level 3:
Automatic low-risk decisions

Level 4:
Advanced autonomous operation

Generation 1 must default to Level 0/1.

---

# MANAGER OVERRIDE

Managers must always be able to:

- reject recommendation
- force batch
- split batch
- unassign driver
- change driver
- dispatch immediately
- delay dispatch
- override suggested route

All overrides must be logged.

---

# SPECIAL CASES

Support:

1. Order already in preparation + new compatible order.

2. Ready order waiting for another order.

3. Kitchen overloaded.

4. Driver shortage.

5. Multiple deliveries in same direction.

6. Close destinations but opposite directions.

7. One far destination + one close destination.

8. One urgent order + one flexible order.

9. Customer SLA about to expire.

10. Restaurant-specific rules.

---

# HUMAN DECISION LEARNING

Allow managers to provide rejection reasons.

Examples:

- Opposite directions
- Customer priority
- Driver issue
- Kitchen issue
- Order already ready
- Too much waiting
- Special customer
- Operational reason
- Other

The system should later use this information as learning signals.

---

# TESTING

Automated tests must cover:

- scoring
- route direction
- distance
- SLA
- preparation compatibility
- driver availability
- kitchen load
- manager approval
- rejection
- override
- forced batching
- batch splitting
- race conditions
- duplicate requests
- concurrent managers
- tenant isolation

Create deterministic test fixtures.

---

# SIMULATION TESTS

Build a delivery simulator.

It must be able to generate:

- orders
- drivers
- kitchen load
- destinations
- preparation times
- delivery times

Use the simulator to evaluate batching algorithms.

---

# MANUAL TESTING

Create:

/docs/testing/manual/DELIVERY_MANUAL_TEST.md

Include realistic scenarios.

Also create:

/docs/testing/manual/DELIVERY_PEAK_LOAD_TEST.md

Simulate:

- 50 orders
- 100 orders
- 250 orders
- multiple drivers
- overloaded kitchen
- changing driver availability

---

# SECURITY & PRIVACY (PHASE 00 Sections 31 & 42)

Protect:

- driver personal information
- customer addresses and delivery notes
- telemetry and GPS coordinates

Driver Data Minimization:
- Couriers MUST ONLY receive `DeliveryViewDTO`.
- Do NOT expose entire Customer CRM entities, historical spending, or unrelated orders to a driver.

Fleet Telemetry Privacy & Data Minimization:
- Collect vehicle telemetry strictly during active driver shifts (`ON_SHIFT`).
- Telemetry retention is limited to a 30-day rolling window with automated partitioning.
- Track vehicles operationally; never use telemetry as an unrestricted employee surveillance mechanism.
- Enforce tenant and branch isolation at the database, service, and WebSocket channel layers.

---

# AUDIT

Every delivery decision must be auditable.

A manager must be able to answer:

"Why was this delivery batched?"

And:

"Who approved it?"

And eventually:

"Why did the AI recommend it?"

---

# DOCUMENTATION

Create:

/docs/delivery/DELIVERY_ARCHITECTURE.md
/docs/delivery/BATCHING_ENGINE.md
/docs/delivery/LEARNING_SYSTEM.md
/docs/delivery/AI_ROADMAP.md

Update roadmap and implementation status.