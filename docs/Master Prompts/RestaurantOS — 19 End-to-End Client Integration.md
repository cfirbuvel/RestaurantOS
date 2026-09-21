# RestaurantOS — Prompt 19

## Multi-Client End-to-End Integration

Continue from all previous RestaurantOS implementation.

Do not rewrite clients.

Do not replace existing APIs.

Validate that the clients operate against the same backend truth.

---

# Scenario 1 — New Order

Customer:

1. creates order

Restaurant:

1. receives order

KDS:

1. receives ticket

Kitchen:

1. starts ticket
2. marks ready

Manager:

1. sees operational update

---

# Scenario 2 — Delivery

Order becomes delivery-ready.

Manager:

1. sees delivery

Driver:

1. receives assignment

Driver:

1. starts delivery

Fleet:

1. reports telemetry

Manager:

1. sees state

Driver:

1. completes delivery

Backend:

1. updates availability

Driver:

1. returns to restaurant

Driver becomes:

`AVAILABLE`

---

# Scenario 3 — Self Assignment Race

Two drivers attempt self-assignment simultaneously.

Expected:

* exactly one succeeds
* other receives conflict
* UI reconciles
* no duplicate assignment

---

# Scenario 4 — KDS SLA

Ticket approaches SLA.

KDS:

* changes visual state

Ticket exceeds SLA.

Manager:

* receives notification

KDS:

* shows critical SLA state

---

# Scenario 5 — Network Failure

Disconnect mobile device.

Perform safe read operations.

Reconnect.

Expected:

* session recovery
* state reconciliation
* no duplicate commands
* correct server state

---

# Scenario 6 — Tenant Isolation

Create test data for:

Tenant A
Branch A

Tenant B
Branch B

Verify every client.

No cross-tenant data.

---

# Scenario 7 — Permissions

Test multiple roles.

Unauthorized actions must fail server-side even if a client attempts them directly.

---

# Automated E2E

Implement or extend E2E coverage for the above scenarios.

Use deterministic test data.

Avoid external production providers.

Use mocks/adapters where appropriate.

---

# Definition of Done

All clients operate against the same RestaurantOS backend/domain contracts.

No client contains conflicting business rules.

Critical operational flows work end-to-end.
