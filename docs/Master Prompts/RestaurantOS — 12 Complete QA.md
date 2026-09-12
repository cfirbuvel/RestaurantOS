# RestaurantOS — Complete QA and Verification

Act as an independent QA organization.

Do not assume previous agents implemented features correctly.

---

# TEST LEVELS

Run:

Unit
Integration
API
Database
Contract
E2E
Regression
Security
Performance
Accessibility
Mobile
Responsive
Browser compatibility

---

# MANDATORY DOMAIN & CONCURRENCY TEST SUITES (PHASE 00 Section 46)

## 1. Domain Tests
- Universal Order and Delivery state machines are strictly decoupled.
- Invalid state transitions rejected.
- Delivery release returns state to `AVAILABLE_FOR_ASSIGNMENT`.
- Driver availability queue ordering based on `available_since ASC`.
- Driver return-from-break (`DriverReturnedFromBreak`) vs physical restaurant return (`DriverReturnedToRestaurant`) verified as separate events.
- Vehicle-Driver temporal assignment tracking.
- Vehicle-Tracker temporal assignment tracking.
- Telemetry normalization and geofence events.
- **Telemetry $\neq$ Business Truth:** GPS entry to customer geofence emits `ARRIVED_AT_CUSTOMER_AREA` but NEVER automatically marks order `DELIVERED`.

## 2. Security Tests
- Cross-tenant vehicle, tracker, and telemetry access strictly denied.
- Couriers restricted to `DeliveryViewDTO` (cannot access unrestricted CRM or spending history).
- Unauthorized realtime channel subscriptions blocked.
- WebSocket ticket expiration (60s TTL) and single-use invalidation.

## 3. Concurrency & Collision Scenarios
Execute parallel simulation where exactly ONE valid state update must succeed:
- Two drivers self-assign the same delivery simultaneously.
- Manager assigns while driver self-assigns.
- Driver self-assigns while batch approval occurs.
- Delivery released while another driver attempts assignment.
- Driver returns while dispatcher assigns next delivery.

# BUSINESS FLOWS

Test complete flows:

Customer
→ Order
→ Kitchen
→ Ready
→ Delivery
→ Driver
→ Delivered
→ CRM
→ Analytics

Inventory:

Purchase
→ Receive
→ Warehouse
→ Recipe
→ Sale
→ Deduction
→ Reporting

Marketing:

Customer
→ Campaign
→ Coupon
→ Order
→ Redemption
→ Analytics

---

# FAILURE TESTING

Simulate:

- database failure
- network failure
- provider failure
- webhook duplication
- timeout
- browser refresh
- concurrent employees
- duplicate clicks
- stale sessions
- partial transaction failure

---

# LOAD

Test realistic restaurant load.

Include:

100 concurrent users
500 concurrent users
1000 concurrent API operations where appropriate

Measure:

latency
error rate
CPU
memory
database performance
queue latency

---

# ACCESSIBILITY

Test WCAG-oriented accessibility.

---

# MANUAL TESTING

Every module must have a manual checklist.

A manual test is only PASS if:

Expected result matches actual result.

Record:

Environment
Browser
Device
Test data
Steps
Expected
Actual
Result
Screenshot/evidence where useful

---

# FINAL QA REPORT

Create:

/docs/testing/FINAL_QA_REPORT.md

Classify:

Critical
High
Medium
Low

Do not declare production ready while critical issues remain.