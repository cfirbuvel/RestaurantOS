# RestaurantOS — Phase 2: CRM, Menu and Universal Orders

Implement the customer, menu and order domains.

---

# CRM

Implement:

Customer
CustomerProfile
Phone
Email
Birthdate
Addresses
Delivery instructions
Building
Entrance
Floor
Apartment
Notes
Allergies
Preferences
VIP status
Order history
Lifetime value
Last order
Order frequency

Do not expose customer data to unauthorized employees.

---

# ADDRESS INTELLIGENCE

Support:

- multiple addresses
- default address
- delivery notes
- entrance instructions
- gate codes
- parking instructions
- apartment details

Sensitive information must have appropriate access controls.

---

# MENU

Implement:

Categories
Products
Variants
Modifiers
Modifier groups
Prices
Availability
Branch-specific availability
Tax configuration
Images
Product descriptions

Support future recipe/BOM relationships.

---

# UNIVERSAL ORDER MODEL

Orders can originate from:

- Website
- Kiosk
- Phone
- POS
- Wolt
- 10bis
- Mishloha
- Manual employee entry

Normalize them into the RestaurantOS order model.

---

# ORDER STATES

MANDATORY ARCHITECTURAL RULE (PHASE 00 Section 3):
Do NOT use one status machine for both Orders and Deliveries. They are separate domain concepts.

Canonical Universal Order Lifecycle:
- DRAFT
- CONFIRMED
- ACCEPTED
- IN_PREPARATION
- READY
- COMPLETED
Terminal:
- CANCELLED
- FAILED

CRITICAL CONTRACT:
Order status represents the lifecycle of the customer purchase/kitchen order itself.
Order status must NOT represent:
- driver assignment
- delivery trip
- driver arrival
- vehicle movement
- delivery completion

Pickup, dine-in, kiosk, and counter orders must NEVER be forced into a Delivery lifecycle.

---

# ORDER DOMAIN COMMANDS

Avoid generic CRUD status mutation (`PATCH /orders/:id/status`). Use explicit domain commands (PHASE 00 Section 5):

- `POST /orders/:id/confirm`
- `POST /orders/:id/accept`
- `POST /orders/:id/start-preparation`
- `POST /orders/:id/ready`
- `POST /orders/:id/complete`
- `POST /orders/:id/cancel`

For every command enforce:
- authorization
- valid source states
- resulting state
- actor
- idempotency behavior
- emitted events
- audit requirements

---

# ORDER MANAGEMENT & DATA MINIMIZATION

Implement:

- create order
- edit order
- cancel order
- duplicate order
- customer lookup
- previous order lookup
- notes
- payment status
- source & timestamps

Data Minimization for Delivery (PHASE 00 Section 31):
- Do NOT expose entire Customer CRM entities to drivers.
- Provide a restricted `DeliveryViewDTO` containing only operational information: customer display name, delivery address, access instructions, and delivery notes.

---

# TESTING

Automated:

- unit tests
- order state tests
- API tests
- permission tests
- tenant isolation
- regression tests
- E2E order creation
- E2E cancellation
- E2E customer lookup

Manual:

Create:

/docs/testing/manual/ORDERS_MANUAL_TEST.md

Include normal cases and edge cases.

Examples:

- duplicate order
- cancellation
- unavailable product
- invalid modifier
- price change
- customer with multiple addresses
- unauthorized employee
- simultaneous updates
- network failure
- retry

---

# SECURITY

Test:

- IDOR
- privilege escalation
- tenant isolation
- malicious input
- customer-data exposure
- API abuse

---

# PERFORMANCE

Ensure order creation is fast.

Do not block the UI unnecessarily.

Use asynchronous processing for non-critical operations where appropriate.

Update documentation and implementation status.