**Phase 0 Contract Alignment / Amendment prompt**

# RESTAURANTOS — PHASE 0 CONTRACT ALIGNMENT & ARCHITECTURAL AMENDMENT

## ROLE

You are acting as the Principal Software Architect, Domain Architect, Security Architect, Database Architect, API Architect, QA Architect, and Technical Product Architect for RestaurantOS.

You are continuing from an existing Phase 0 architecture/documentation effort.

The existing architecture is strong and must NOT be unnecessarily redesigned.

Your task is to perform a STRICT:

> PHASE 0 CONTRACT ALIGNMENT / AMENDMENT ONLY

This phase exists to eliminate architectural contradictions and establish one internally consistent contract across:

- Domain model
- Architecture
- Database
- API
- Events
- Security
- Integrations
- Delivery
- Fleet tracking
- KDS
- Roadmap
- ADRs
- Testing strategy
- Implementation status

DO NOT implement Phase 1 features.

DO NOT start production development.

DO NOT build UI.

DO NOT create application services/controllers/repositories unless required only for documentation examples.

DO NOT redesign unrelated architecture.

DO NOT replace the existing architecture with a different architecture.

Preserve all valid existing decisions and amend only what is necessary.

---

# 1. SOURCE OF TRUTH

Before making changes:

1. Read the complete existing repository documentation.
2. Inspect all existing architecture and planning documents.
3. Identify contradictions between documents.
4. Produce a mental dependency map of the affected contracts.
5. Apply the amendments consistently across all affected documents.

Relevant documents include, but are not limited to:

- PROJECT_AUDIT.md
- README.md
- ARCHITECTURE.md
- PRODUCT_REQUIREMENTS.md
- API.md
- DATABASE.md
- SCHEMA.md
- SECURITY.md
- SECURITY_ARCHITECTURE.md
- TESTING.md
- TESTING_STRATEGY.md
- DEPLOYMENT.md
- OPERATIONS.md
- INTEGRATIONS.md
- ROADMAP.md
- IMPLEMENTATION_STATUS.md
- EVENTS.md
- DOMAIN_MODEL.md
- DELIVERY.md
- all existing ADRs
- especially ADR 0007
- especially ADR 0008

If a document does not exist, do NOT invent a fake existing document.

If a concept is already documented elsewhere, update that source instead of creating unnecessary duplicate documentation.

---

# 2. PRIMARY OBJECTIVE

After this amendment, the RestaurantOS documentation must have ONE consistent domain contract.

There must be no contradictions between:

- Order lifecycle
- Delivery lifecycle
- Driver lifecycle
- Driver queue
- Vehicle lifecycle
- Tracker lifecycle
- Fleet telemetry
- Geofencing
- Smart batching
- KDS
- API commands
- Events
- Database schema
- Security rules
- Integration adapters
- Gen 1 / Gen 2 boundaries

The result must be:

> PHASE 0 AMENDED / READY FOR PHASE 1

Only mark Phase 0 ready after performing the final consistency validation described at the end of this prompt.

---

# 3. ORDER LIFECYCLE VS DELIVERY LIFECYCLE

This is a mandatory correction.

Do NOT use one status machine for both Orders and Deliveries.

They are separate domain concepts.

## 3.1 Universal Order lifecycle

Define the Universal Order lifecycle independently.

Recommended canonical lifecycle:

```text
DRAFT
CONFIRMED
ACCEPTED
IN_PREPARATION
READY
COMPLETED
CANCELLED
FAILED
````

You may refine names only if existing architecture requires it, but the fundamental rule must remain:

> Order status represents the lifecycle of the customer order itself.

Order status must NOT represent:

- driver assignment
- delivery trip
- driver arrival
- vehicle movement
- delivery completion

---

# 4. DELIVERY LIFECYCLE

Create an independent Delivery state machine.

Recommended canonical lifecycle:

```text
WAITING
PREPARING
READY
AVAILABLE_FOR_ASSIGNMENT
ASSIGNED
PICKED_UP
OUT_FOR_DELIVERY
ARRIVED_AT_CUSTOMER_AREA
DELIVERED
FAILED
CANCELLED
```

Important:

A Delivery may return to:

```text
AVAILABLE_FOR_ASSIGNMENT
```

after being released before pickup.

A release is a domain command/event/reason.

Do NOT create unnecessary "RELEASED" as a permanent delivery state unless the domain model proves that it is necessary.

The distinction must be explicit:

```text
Order = what the customer ordered

Delivery = how that order is transported to the customer
```

A delivery may exist only for orders requiring delivery.

Pickup, dine-in, kiosk, website pickup, etc. must not be forced into the Delivery lifecycle.

---

# 5. DOMAIN COMMANDS

Replace generic status mutation concepts wherever appropriate.

Avoid relying on:

```text
PATCH /orders/:id/status
```

for domain operations.

Prefer explicit commands.

Examples:

```text
POST /deliveries/:id/assign
POST /deliveries/:id/self-assign
POST /deliveries/:id/release
POST /deliveries/:id/pickup
POST /deliveries/:id/start
POST /deliveries/:id/arrive
POST /deliveries/:id/complete
POST /deliveries/:id/fail
POST /deliveries/:id/cancel
```

For orders use explicit domain commands where appropriate:

```text
POST /orders/:id/confirm
POST /orders/:id/accept
POST /orders/:id/start-preparation
POST /orders/:id/ready
POST /orders/:id/complete
POST /orders/:id/cancel
```

Do not blindly implement every example.

The API documentation must reflect domain semantics rather than generic CRUD status mutation.

For every state-changing command document:

- authorization
- valid source states
- resulting state
- actor
- idempotency behavior
- emitted events
- audit requirements
- failure cases

---

# 6. DRIVER STATE MODEL

The existing Driver status concept is overloaded.

Separate these conceptual dimensions:

## Shift status

```text
OFF_SHIFT
ON_SHIFT
BREAK
```

## Assignment status

```text
AVAILABLE
ASSIGNED
```

## Trip status

```text
NOT_STARTED
IN_TRANSIT
AT_CUSTOMER
RETURNING
```

Do not necessarily create three independent tables if that would overcomplicate the implementation.

However, the DOMAIN MODEL must clearly separate these concepts.

A driver being:

```text
ON_SHIFT + AVAILABLE + NOT_STARTED
```

means something fundamentally different from:

```text
ON_SHIFT + ASSIGNED + IN_TRANSIT
```

Do not encode unrelated concepts into one giant enum.

---

# 7. DRIVER QUEUE

The Driver Availability Queue is a first-class operational concept.

The canonical queue ordering is:

```text
available_since ASC
```

Meaning:

> The driver who became available first gets priority for the next eligible delivery.

Do NOT store queue position as the source of truth.

Queue position must be derived from availability state/time.

Define clearly:

```text
available_since
```

and explain when it changes.

For example:

- driver starts shift and becomes available
- driver returns from delivery
- driver returns from break
- driver becomes eligible again after assignment release

The exact transitions must be documented consistently.

---

# 8. DRIVER RETURN SEMANTICS

Fix the existing ambiguity around "return".

There are at least two different concepts:

## A. Return from break

Example:

```text
POST /drivers/me/return-from-break
```

This means:

> Driver finished a break.

## B. Physical return to restaurant

Example:

```text
POST /drivers/me/arrived-at-restaurant
```

This means:

> Driver/vehicle physically returned to the restaurant.

These MUST NOT be treated as the same event.

The system must support:

```text
DriverReturnedFromBreak
```

and:

```text
DriverReturnedToRestaurant
```

as separate domain events.

Future vehicle telemetry/geofencing may automatically infer:

```text
VehicleEnteredRestaurantGeofence
```

and then potentially:

```text
DriverReturnedToRestaurant
```

but manual fallback must remain available.

---

# 9. SELF-ASSIGNMENT

Preserve the existing requirement:

A manager may enable driver self-assignment.

Eligible drivers may claim an available delivery without manager intervention.

Requirements:

- per-driver permission
- branch/tenant scoped
- delivery must be eligible
- driver must be eligible
- atomic assignment
- race-condition safe
- only one driver can win
- audit assignment source
- support manager override

Assignment sources must be modeled explicitly:

```text
MANAGER
DRIVER_SELF_ASSIGN
SYSTEM_RECOMMENDATION
FUTURE_AGENT
```

Do NOT implement autonomous agent assignment in Gen 1.

---

# 10. DELIVERY ASSIGNMENT ENGINE

Make the Delivery Assignment Engine the single source of truth for delivery assignment.

Use a strategy architecture.

Required conceptual strategies:

```text
FIFOAssignmentStrategy
FIFOAreaAssignmentStrategy
SmartRecommendationStrategy
FutureAgentAssignmentStrategy
```

Policy examples:

```text
FIFO
FIFO_WITH_AREA
SMART_RECOMMENDATION
MANAGER_ONLY
```

All assignment paths must eventually pass through the same assignment domain rules.

There must not be separate incompatible assignment logic in:

- manager UI
- driver self-assignment
- batch assignment
- smart recommendations
- future AI

All assignment operations must be:

- atomic
- tenant scoped
- branch scoped
- authorization checked
- auditable
- idempotent where applicable

---

# 11. SMART BATCHING

Preserve ADR 0007.

Gen 1 must remain deterministic.

Gen 1 batching inputs:

- straight-line/geospatial distance
- route direction / azimuth
- order age
- SLA headroom
- kitchen readiness
- estimated readiness
- driver availability
- vehicle capacity
- geographic compatibility
- maximum waiting window

Gen 2 may add:

- road distance
- estimated travel time
- traffic
- historical travel times
- historical delivery performance
- learned patterns

Do NOT introduce ML/autonomous AI into Gen 1 execution.

The recommendation engine may suggest:

```text
Batch A + Batch B
```

but a human must approve it in Gen 1.

---

# 12. DELIVERY BATCH DOMAIN

Extend the batch model.

`delivery_batches` must conceptually support:

```text
id
tenant_id
branch_id
status
strategy
score
scoring_breakdown
max_wait_seconds
created_by
approved_by
approval_mode
route_summary
estimated_savings
sla_risk
created_at
updated_at
approved_at
rejected_at
```

Use appropriate names if an existing schema convention differs.

Batch lifecycle must be documented.

For example:

```text
SUGGESTED
APPROVED
REJECTED
DISPATCHED
COMPLETED
CANCELLED
```

Do not allow a rejected recommendation to silently become an assignment.

---

# 13. DECISION / INTELLIGENCE LOGGING

Prepare the architecture for future intelligence.

Any recommendation/decision should be capable of recording:

```text
decision_id
algorithm_version
policy_version
model_version nullable
actor_id
decision
reasoning/scoring breakdown
created_at
resolved_at
```

Gen 1:

```text
model_version = NULL
```

Gen 2+ may populate it.

Human actions must be recorded:

```text
APPROVED
REJECTED
MODIFIED
OVERRIDDEN
```

The system should preserve the outcome of the decision.

This will later support supervised learning and policy evaluation.

---

# 14. VEHICLE AS FIRST-CLASS DOMAIN

Add Vehicle as a first-class domain object.

Do NOT model the vehicle merely as metadata on Driver.

Conceptually define:

```text
Vehicle
```

with fields such as:

```text
id
tenant_id
branch_id
vehicle_type
license_plate
make
model
status
capacity
active
created_at
updated_at
```

Vehicle types may include:

```text
BIKE
SCOOTER
SMALL_CAR
MEDIUM_CAR
LARGE_VAN
TRUCK
```

Use the project's existing terminology if already defined.

Vehicle status should be independently defined from driver status.

---

# 15. DRIVER ↔ VEHICLE ASSIGNMENT

Create a temporal relationship:

```text
DriverVehicleAssignment
```

Conceptually:

```text
driver_id
vehicle_id
assigned_at
unassigned_at
assigned_by
reason
```

A driver may use different vehicles over time.

Do not permanently embed `vehicle_id` directly into the driver as the only relationship.

The current active assignment may be resolved from this relationship.

---

# 16. TRACKER AS FIRST-CLASS DOMAIN

Add:

```text
Tracker
```

as a first-class domain object.

A tracker is NOT the same thing as a vehicle.

A tracker may be replaced or moved between vehicles.

Conceptual fields:

```text
id
tenant_id
provider
provider_device_id
external_device_id / IMEI
status
last_seen_at
last_latitude
last_longitude
battery_level
firmware_version
created_at
updated_at
```

Do not lock RestaurantOS to a specific hardware provider.

---

# 17. VEHICLE ↔ TRACKER ASSIGNMENT

Create:

```text
VehicleTrackerAssignment
```

Conceptually:

```text
vehicle_id
tracker_id
assigned_at
unassigned_at
assigned_by
```

This allows:

```text
Vehicle A -> Tracker X

later:

Vehicle A -> Tracker Y
```

without corrupting historical telemetry.

---

# 18. TRACKER PROVIDER ABSTRACTION

Add tracker support to the Integration Hub.

Do NOT hard-code a tracker vendor into the domain.

Define an abstraction such as:

```text
ITrackerAdapter
```

with capabilities conceptually including:

```text
getDeviceStatus()
getLatestLocation()
subscribeToTelemetry()
processWebhook()
normalizeTelemetry()
```

The Integration Hub must normalize provider-specific data into RestaurantOS canonical telemetry.

Provide:

```text
MockTrackerAdapter
```

for development/testing.

Potential future hardware providers may include GPS/LTE fleet trackers.

Do NOT require a hardware provider decision at this stage.

---

# 19. AIRTAG-LIKE DEVICES

Document the architectural decision:

AirTag/Find My-style devices may be useful as:

- secondary anti-theft tracking
- lost vehicle recovery
- backup location signal

They must NOT be treated as the primary operational fleet telemetry source.

Primary operational fleet tracking should support:

```text
GPS
+
cellular/LTE or equivalent continuous connectivity
```

Do not build RestaurantOS around Apple's Find My network or another proprietary consumer crowd-location network.

---

# 20. VEHICLE LOCATION TELEMETRY

Add:

```text
VehicleLocation
```

Conceptually:

```text
id
tenant_id
branch_id
vehicle_id
tracker_id
latitude
longitude
accuracy_meters
speed_kmh
heading_degrees
battery_level
recorded_at
received_at
```

Distinguish:

```text
recorded_at
```

from:

```text
received_at
```

because telemetry can arrive late.

---

# 21. VEHICLE TRIPS

Add:

```text
VehicleTrip
```

Conceptually:

```text
id
tenant_id
branch_id
vehicle_id
driver_id
delivery_id nullable
started_at
ended_at
start_location
end_location
distance_meters
duration_seconds
status
```

A trip may eventually be associated with a delivery.

Do not assume every vehicle movement is a delivery.

---

# 22. GEOFENCE EVENTS

Add:

```text
GeofenceEvent
```

Conceptually support:

```text
restaurant geofence
customer-area geofence
```

Events may include:

```text
VehicleEnteredRestaurantGeofence
VehicleExitedRestaurantGeofence
VehicleEnteredCustomerGeofence
VehicleExitedCustomerGeofence
```

Additional normalized events:

```text
VehicleStartedMoving
VehicleStopped
VehicleDepartedRestaurant
VehicleArrivedCustomerArea
VehicleLeftCustomerArea
VehicleReturnedToRestaurant
```

Geofence configuration must be branch/tenant scoped.

Customer geofences must be privacy-conscious and operationally justified.

Do not create permanent customer location tracking merely because a delivery exists.

---

# 23. TELEMETRY ≠ BUSINESS TRUTH

This is extremely important.

Vehicle GPS telemetry may infer:

```text
ARRIVED_AT_CUSTOMER_AREA
```

but it must NOT automatically mean:

```text
DELIVERED
```

GPS arrival is evidence of physical proximity.

Delivery completion remains a business workflow event and may require:

- driver confirmation
- proof of delivery
- customer confirmation
- other configured evidence

Therefore:

```text
VehicleEnteredCustomerGeofence
```

may trigger:

```text
DeliveryArrivedAtCustomerArea
```

but must NOT automatically trigger:

```text
DeliveryCompleted
```

unless a future explicitly approved policy allows it.

Gen 1 must preserve human/business confirmation.

---

# 24. TRACKER EVENTS

Add canonical events such as:

```text
VehicleLocationReceived
VehicleStartedMoving
VehicleStopped
VehicleEnteredRestaurantGeofence
VehicleExitedRestaurantGeofence
VehicleEnteredCustomerGeofence
VehicleExitedCustomerGeofence
VehicleDepartedRestaurant
VehicleArrivedCustomerArea
VehicleLeftCustomerArea
VehicleReturnedToRestaurant

TrackerOnline
TrackerOffline
TrackerBatteryLow
TrackerTamperDetected
```

Also support:

```text
DeliveryTripStarted
DeliveryTripArrived
DeliveryTripCompleted
```

where appropriate.

Clearly distinguish:

- telemetry events
- geofence events
- domain business events

---

# 25. DELIVERY + VEHICLE + DRIVER MODEL

Document the relationship:

```text
Driver
   |
   | active assignment
   v
Vehicle
   |
   | active assignment
   v
Tracker
   |
   | telemetry
   v
VehicleLocation
   |
   v
GeofenceEvent
   |
   v
DeliveryTrip
   |
   v
Delivery
```

Do not imply that every delivery requires a tracker.

Do not imply that every vehicle movement is a delivery.

Do not imply that a tracker identifies a driver by itself.

The system should resolve:

```text
Driver -> Vehicle -> Tracker
```

using active assignments.

---

# 26. KDS ALIGNMENT

Ensure KDS remains independent from delivery tracking.

KDS lifecycle should describe food preparation, not driver movement.

For example:

```text
QUEUED
STARTED
READY
RECALLED
COMPLETED
```

Use existing terminology if already defined.

The KDS must not use Delivery status as its source of truth.

The system may react to:

```text
OrderReady
```

and then make a Delivery:

```text
AVAILABLE_FOR_ASSIGNMENT
```

when appropriate.

Document this event-driven relationship.

---

# 27. KDS SLA MODEL

Preserve the existing SLA visualization requirements.

Document:

```text
NORMAL
NEAR_SLA
SLA_EXCEEDED
```

For exceeded SLA:

- full red header
- white text
- very large elapsed timer
- warning icon
- subtle pulse
- visible from approximately 1.5–2 meters

Example:

```text
+00:37
```

Do not introduce decorative animation that reduces operational clarity.

---

# 28. WEBSOCKET AUTHENTICATION

Fix the existing WebSocket security concern.

Do NOT use long-lived JWTs directly in query parameters:

```text
/ws?token=<long-lived-token>
```

Prefer:

```text
authenticated handshake
```

or:

```text
short-lived WebSocket connection ticket
```

The documentation must explain:

- authentication
- authorization
- tenant isolation
- branch isolation
- channel authorization
- token expiration
- reconnect behavior
- revocation

---

# 29. REALTIME CHANNEL SECURITY

Do not treat one realtime stream as globally accessible.

Document separate logical authorization boundaries for:

```text
KDS
DISPATCH
DRIVER
PUBLIC_TRACKING
VEHICLE_TELEMETRY
ADMIN
```

A driver must not receive:

- unrelated restaurant data
- full CRM data
- other branches
- unrestricted telemetry

---

# 30. SSE

Clarify SSE boundaries.

Potential streams:

```text
KDS events
Dispatch events
Driver events
Vehicle telemetry
Public tracking
```

Each must have explicit authorization and data minimization.

---

# 31. DRIVER DATA SECURITY

Create a restricted:

```text
DeliveryViewDTO
```

for drivers.

Do NOT expose the entire Customer CRM entity to a driver.

Only expose operationally necessary information, such as:

- customer display name where required
- delivery address
- delivery notes
- building access information where required
- parking/access instructions
- contact information where operationally justified

Document least-privilege principles.

Sensitive customer information must not be exposed merely because it exists in CRM.

---

# 32. MULTI-TENANT INTEGRITY

Tenant isolation must exist at multiple layers.

Document:

```text
tenant_id
branch_id
```

integrity rules.

Where appropriate use:

- composite foreign keys
- RLS
- service-layer authorization
- branch scoping
- tenant-scoped queries
- cross-tenant negative tests

Example principle:

```text
A Delivery belonging to Tenant A
MUST NOT reference:

Driver belonging to Tenant B
Vehicle belonging to Tenant B
Tracker belonging to Tenant B
Branch belonging to Tenant B
```

Do not rely solely on application code.

---

# 33. DATABASE MODEL

Update DATABASE.md / SCHEMA.md consistently.

Ensure the schema conceptually includes:

```text
vehicles
driver_vehicle_assignments
trackers
vehicle_tracker_assignments
vehicle_locations
vehicle_trips
geofence_events
```

Add appropriate:

- indexes
- tenant indexes
- branch indexes
- temporal indexes
- geospatial indexes
- uniqueness constraints
- foreign keys
- check constraints
- RLS policies

Vehicle location data can become extremely large.

Document an appropriate retention/partitioning strategy.

Do not blindly store unlimited telemetry forever.

---

# 34. INVENTORY TIMING

Resolve inventory timing ambiguity.

Document inventory deduction as a configurable business policy.

Possible policies:

```text
ON_ACCEPTED
ON_PREPARATION_START
ON_FULFILLMENT
```

The chosen default must be explicitly stated.

The architecture must allow the policy to change without rewriting inventory logic.

Do not leave inventory deduction timing implicit.

---

# 35. INTEGRATION CLASSIFICATION

Clarify integrations into two categories.

## Core business integrations

```text
Wolt
10bis
Mishloha
Green Invoice
Rivhit
iCount
Meshulam
```

## Platform/infrastructure integrations

```text
Stripe
Twilio
Maps provider
SIP/WebRTC
Tracker providers
```

The exact provider list may evolve.

External provider formats must NEVER leak into the core domain.

All providers must use adapters and canonical DTOs.

---

# 36. INTEGRATION PIPELINE

Preserve the existing normalized integration pipeline:

```text
Receive
  ↓
Verify signature
  ↓
Verify timestamp
  ↓
Idempotency
  ↓
Transform
  ↓
Universal DTO
  ↓
Validate
  ↓
Persist
  ↓
Transactional Outbox
  ↓
Publish Domain/Event
  ↓
Realtime consumers
```

Update documentation to ensure Tracker integrations follow the same architectural principles.

---

# 37. IDEMPOTENCY

Every state-changing external command/API operation must clearly define idempotency.

Especially:

- assignment
- self-assignment
- release
- pickup
- start
- arrive
- complete
- batch approval
- batch rejection
- webhook ingestion
- telemetry ingestion where duplicate packets are possible

Do not allow duplicate webhook/telemetry messages to corrupt state.

---

# 38. EVENT CATALOG

If EVENTS.md exists, update it.

If it does not exist and the event catalog is currently fragmented across documents, create it only if it materially improves consistency.

For every important event document:

```text
Event name
Aggregate/context
Trigger
Payload
Tenant scope
Branch scope
Consumers
Idempotency expectations
Security classification
```

At minimum reconcile:

### Order events

```text
OrderConfirmed
OrderAccepted
OrderPreparationStarted
OrderReady
OrderCompleted
OrderCancelled
OrderFailed
```

### Delivery events

```text
DeliveryBecameAssignable
DeliveryAssigned
DeliverySelfAssigned
DeliveryReleased
DeliveryPickedUp
DeliveryDispatched
DeliveryArrivedAtCustomerArea
DeliveryCompleted
DeliveryFailed
DeliveryCancelled
```

### Driver events

```text
DriverClockedIn
DriverBecameAvailable
DriverEnteredQueue
DriverLeftQueue
DriverWentOnBreak
DriverReturnedFromBreak
DriverReturnedToRestaurant
```

### Vehicle events

```text
VehicleLocationReceived
VehicleStartedMoving
VehicleStopped
VehicleDepartedRestaurant
VehicleReturnedToRestaurant
VehicleArrivedCustomerArea
VehicleLeftCustomerArea
```

### Tracker events

```text
TrackerOnline
TrackerOffline
TrackerBatteryLow
TrackerTamperDetected
```

### Batch events

```text
DeliveryBatchSuggested
DeliveryBatchApproved
DeliveryBatchRejected
DeliveryBatchDispatched
```

---

# 39. ADR 0007

Review ADR 0007:

> Delivery Dispatch Concurrency & Smart Batching

Update it if required so it remains consistent with:

- separate Delivery lifecycle
- Driver availability queue
- Vehicle
- Driver/Vehicle relationship
- vehicle capacity
- deterministic Gen 1 batching
- future road-distance/travel-time intelligence
- atomic assignment
- concurrency controls
- human approval
- decision logging

Do not remove the valuable concurrency architecture.

Preserve:

- atomic conditional DB update
- race-condition protection
- Redis Redlock where justified
- FIFO queue
- smart batching strategy architecture

---

# 40. ADR 0008

Review ADR 0008:

> Gen 1 Human-Operated / Future AI Scaffolding

Preserve its fundamental decision.

Gen 1:

```text
Human-operated
Deterministic
Auditable
Recommendations require human approval
No autonomous operational AI
```

Future generations may introduce:

```text
IPredictionEngine
IRecommendationEngine
IDecisionEngine
ILearningEngine
IAutomationPolicyEngine
```

Ensure Vehicle/Fleet Intelligence does not accidentally violate this boundary.

---

# 41. NEW ADR

If appropriate, create:

```text
ADR-0009 — Vehicle Fleet Tracking & Telemetry Architecture
```

The ADR should explain:

- Vehicle is first-class domain
- Tracker is first-class domain
- Driver ↔ Vehicle is temporal
- Vehicle ↔ Tracker is temporal
- GPS/LTE is primary operational telemetry
- AirTag-like technology is secondary
- provider abstraction
- canonical telemetry
- geofencing
- privacy
- telemetry ≠ delivery completion
- future hardware provider flexibility
- Gen 1 vs future intelligence boundary

Use the repository's existing ADR formatting.

---

# 42. PRIVACY

Fleet tracking must be designed with data minimization.

Document:

- why vehicle location is collected
- when it is collected
- who can see it
- retention period
- branch/tenant boundaries
- driver visibility
- admin visibility
- public tracking restrictions
- telemetry access auditing

Avoid unnecessary continuous personal tracking.

Track the vehicle operationally, not as a justification for unrestricted employee surveillance.

---

# 43. API RESPONSE CONTRACT

Review API.md.

Do not force pagination into every response.

Use:

## List responses

```text
data
pagination
meta
```

## Single resource/action responses

```text
data
meta
```

No meaningless pagination object for:

```text
POST /deliveries/:id/assign
```

or:

```text
GET /deliveries/:id
```

---

# 44. ROADMAP

Update ROADMAP.md.

Phase 4 should explicitly become:

```text
Phase 4 — Delivery, Driver Queue, Fleet Tracking & Smart Batching
```

It must include:

- delivery lifecycle
- driver queue
- self-assignment
- FIFO
- smart batching
- Vehicle
- Tracker
- telemetry
- geofencing
- trip tracking
- integration abstraction
- concurrency
- auditability

Do NOT move the system into autonomous AI.

Future intelligence remains later phases/generations.

---

# 45. IMPLEMENTATION STATUS

Update IMPLEMENTATION_STATUS.md.

Phase 0 should NOT be called simply "Complete" immediately.

Use:

```text
PHASE 0 — AMENDED / PENDING FINAL CONSISTENCY VALIDATION
```

Only after all checks pass change it to:

```text
PHASE 0 — AMENDED / READY FOR PHASE 1
```

Phase 1 remains:

```text
PENDING
```

Do not accidentally mark any implementation phase as complete.

---

# 46. TESTING STRATEGY

Update TESTING.md / TESTING_STRATEGY.md.

Add explicit test requirements for the new contracts.

## Domain tests

- Order and Delivery state machines are independent
- invalid state transitions rejected
- delivery release returns to assignable state
- driver queue ordering
- driver return-from-break vs physical restaurant return
- driver self-assignment
- assignment race conditions
- batch approval/rejection
- vehicle-driver assignment
- vehicle-tracker assignment
- telemetry normalization
- geofence events
- telemetry does not auto-complete delivery

## Security tests

- cross-tenant vehicle access denied
- cross-tenant tracker access denied
- cross-branch access denied
- driver cannot access unrestricted CRM
- unauthorized telemetry subscription denied
- WebSocket ticket expiration
- realtime channel authorization

## Concurrency tests

Include scenarios such as:

```text
Two drivers self-assign same delivery
Manager assigns while driver self-assigns
Driver self-assigns while batch approval occurs
Delivery released while another driver attempts assignment
Driver returns while dispatcher assigns next delivery
```

Exactly one valid assignment must win.

---

# 47. CONTRACT MATRIX

Create or update a contract matrix.

At minimum map:

| Concept          | Domain | Database | API | Events | Security | Tests |
| ---------------- | ------ | -------- | --- | ------ | -------- | ----- |
| Order            | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Delivery         | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Driver           | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Driver Queue     | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Vehicle          | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Tracker          | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Vehicle Location | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Vehicle Trip     | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Geofence         | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |
| Smart Batch      | ✓      | ✓        | ✓   | ✓      | ✓        | ✓     |

Every row must be internally consistent.

---

# 48. CROSS-DOCUMENT CONSISTENCY CHECK

After making all amendments, perform a final audit.

Search the entire repository for old/conflicting concepts.

Specifically search for:

```text
order status
delivery status
driver status
queue return
clock-in
return
vehicle
tracker
tracking
telemetry
geofence
batch
assignment
WebSocket token
pagination
inventory deduction
AI automation
```

Look for contradictions such as:

```text
Order = OUT_FOR_DELIVERY
Delivery = IN_PREPARATION
Driver RETURN = break return
Driver RETURN = restaurant return
AirTag = primary tracking
GPS arrival = delivery completed
driver status = all lifecycle dimensions
generic PATCH status = primary state machine
long-lived JWT in WebSocket URL
```

Fix all contradictions found.

---

# 49. DOCUMENT QUALITY RULES

Do not create duplicate definitions that can drift.

For every important domain concept there should be one canonical definition.

Other documents should reference that definition consistently.

Use consistent terminology everywhere.

Do not alternate randomly between:

```text
Driver
Courier
Delivery Driver
שליח
```

unless terminology is intentionally defined.

Likewise:

```text
Vehicle
Tracker
Delivery
Order
Batch
Trip
Telemetry
Geofence
```

must each have explicit meanings.

---

# 50. NO FEATURE IMPLEMENTATION

This task is documentation/schema-contract alignment ONLY.

Do NOT:

- build frontend
- build backend
- create database migrations
- implement APIs
- install infrastructure
- configure production
- deploy
- connect Wolt
- connect 10bis
- connect Mishloha
- connect trackers
- purchase hardware
- activate Twilio
- activate Stripe
- build AI agents

You may update conceptual schema definitions and API specifications.

The actual implementation belongs to later phases.

---

# 51. VALIDATION

Before finishing:

1. Validate Markdown formatting.
2. Validate internal document references.
3. Validate API endpoint consistency.
4. Validate state machine consistency.
5. Validate event naming consistency.
6. Validate database relationship consistency.
7. Validate tenant/branch relationships.
8. Validate security boundaries.
9. Validate ADR consistency.
10. Validate roadmap consistency.
11. Validate testing coverage.
12. Validate Gen 1 vs future AI boundaries.

If automated documentation/static validation exists, run it.

Do NOT start Phase 1 tests or feature implementation.

---

# 52. FINAL DELIVERABLE

Create:

```text
PHASE_0_CONTRACT_ALIGNMENT_REPORT.md
```

The report must contain:

## 1. Executive Summary

What was wrong and what was corrected.

## 2. Documents Modified

Exact files modified.

## 3. Domain Corrections

Especially:

- Order vs Delivery
- Driver lifecycle
- Driver queue
- Vehicle
- Tracker
- Trips
- Telemetry
- Geofencing
- Assignment
- Smart batching

## 4. API Corrections

List changed endpoints/contracts.

## 5. Database Corrections

List new/changed entities and relationships.

## 6. Event Corrections

List new/changed events.

## 7. Security Corrections

Especially:

- WebSocket auth
- tenant isolation
- driver DTO
- telemetry access
- privacy

## 8. Integration Corrections

Especially:

- Tracker adapter
- canonical DTOs
- provider abstraction

## 9. ADR Corrections

List changed ADRs and why.

## 10. Roadmap Corrections

Explain Phase 4 changes.

## 11. Testing Corrections

List new required test categories.

## 12. Remaining Risks

Only genuine unresolved issues.

## 13. Consistency Result

Use exactly one:

```text
PASS — READY FOR PHASE 1
```

or:

```text
FAIL — NOT READY FOR PHASE 1
```

If FAIL, list every blocker.

---

# 53. FINAL ACCEPTANCE CRITERIA

Phase 0 may only be declared:

```text
READY FOR PHASE 1
```

if ALL of the following are true:

[ ] Order lifecycle is independent from Delivery lifecycle.

[ ] Delivery lifecycle is explicitly defined.

[ ] Driver shift/assignment/trip semantics are separated.

[ ] Driver availability queue is based on available_since.

[ ] Driver return-from-break is distinct from physical restaurant return.

[ ] Self-assignment is atomic and auditable.

[ ] Delivery Assignment Engine is the single assignment source of truth.

[ ] Smart batching is deterministic in Gen 1.

[ ] Human approval remains mandatory for Gen 1 recommendations.

[ ] Vehicle is a first-class domain object.

[ ] Driver ↔ Vehicle assignment is modeled.

[ ] Tracker is a first-class domain object.

[ ] Vehicle ↔ Tracker assignment is modeled.

[ ] VehicleLocation is modeled.

[ ] VehicleTrip is modeled.

[ ] GeofenceEvent is modeled.

[ ] Tracker provider abstraction exists conceptually.

[ ] MockTrackerAdapter exists conceptually.

[ ] AirTag-like tracking is explicitly secondary, not primary fleet telemetry.

[ ] GPS arrival does not automatically equal delivery completion.

[ ] Vehicle telemetry events are defined.

[ ] WebSocket authentication no longer relies on long-lived JWT query parameters.

[ ] Realtime channels have authorization boundaries.

[ ] Driver receives restricted Delivery View data.

[ ] Tenant/branch integrity is explicitly enforced.

[ ] Inventory deduction timing is configurable/documented.

[ ] Business vs infrastructure integrations are separated.

[ ] Delivery batches contain required metadata.

[ ] Decision/recommendation logging supports future intelligence.

[ ] ADR 0007 is consistent.

[ ] ADR 0008 is consistent.

[ ] ADR 0009 is created if appropriate.

[ ] ROADMAP is consistent.

[ ] IMPLEMENTATION_STATUS is consistent.

[ ] TESTING_STRATEGY includes all new contracts.

[ ] No contradictory lifecycle definitions remain.

[ ] No Phase 1 implementation was started.

[ ] Final consistency report exists.

---

# 54. IMPORTANT OPERATING PRINCIPLE

Do not "fix" the architecture by simplifying away important domain distinctions.

RestaurantOS is intentionally being designed as a foundation for future generations.

The architecture should therefore be:

```text
Simple enough for Gen 1
Structured enough for Gen 2
Extensible enough for Gen 3
Agent-ready for Gen 4
```

But:

> Future capability must NEVER be allowed to compromise Gen 1 operational determinism, security, auditability, or human control.

Preserve the strong existing architecture.

Amend contradictions.

Do not redesign for the sake of redesigning.

Do not implement features.

Finish only when the documentation forms one coherent technical contract.

FINAL OUTPUT:

1. Apply all required amendments.
2. Create `PHASE_0_CONTRACT_ALIGNMENT_REPORT.md`.
3. Run the consistency validation.
4. Report whether Phase 0 is:

```text
PASS — READY FOR PHASE 1
```

or:

```text
FAIL — NOT READY FOR PHASE 1
```

Do NOT begin Phase 1.

```

### One important change I made

I would **not** tell Antigravity to immediately create database migrations for Vehicle/Tracker. At this stage, the important thing is to establish the **contract** first:

**Driver → Vehicle → Tracker → Telemetry → Geofence → Trip → Delivery**

while keeping the actual hardware/provider implementation for Phase 4.

That prevents us from prematurely coupling RestaurantOS to something like a specific Teltonika/Queclink device or turning the tracker into a driver-location system.

After Antigravity runs this, the next thing I'd want to review is its `PHASE_0_CONTRACT_ALIGNMENT_REPORT.md`. **Only if that passes should we create the Phase 1 implementation prompt.**
```
