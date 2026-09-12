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

Implement a robust state machine.

Example:

Draft
Confirmed
Accepted
InPreparation
Ready
Assigned
OutForDelivery
Delivered
Cancelled
Failed

State transitions must be validated.

---

# ORDER MANAGEMENT

Implement:

- create order
- edit order
- cancel order
- duplicate order
- customer lookup
- previous order lookup
- notes
- payment status
- delivery status
- source
- timestamps

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