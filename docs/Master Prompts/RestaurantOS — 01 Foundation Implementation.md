# RestaurantOS — Phase 1: Production Foundation

Implement the RestaurantOS foundation based on the approved architecture.

Before coding:

1. Read all files under /docs.
2. Read PROJECT_AUDIT.md.
3. Check IMPLEMENTATION_STATUS.md.
4. Do not contradict existing ADRs without creating a new ADR.

---

# IMPLEMENT

Build the production foundation:

## Authentication

Implement:

- registration
- login
- logout
- password reset
- email verification
- session management
- secure cookies
- authentication middleware

## Multi-tenancy

Implement:

Organization
Restaurant
Branch

A user may belong to one or more organizations according to the RBAC design.

Every tenant-owned database query must enforce tenant isolation.

---

# RBAC

Implement roles and permissions.

Example:

Owner
Admin
Manager
Kitchen Manager
Kitchen Employee
Cashier
Delivery Manager
Driver
Inventory Manager
Marketing Manager
Accountant
Viewer

Permissions must be granular.

Examples:

orders.read
orders.create
orders.update
orders.cancel
orders.refund
delivery.read
delivery.assign
delivery.batch
inventory.read
inventory.manage
campaigns.manage
reports.read

---

# AUDIT LOG

Every important operational action must produce an audit record.

Record:

- actor
- organization
- restaurant
- branch
- action
- entity
- entity ID
- timestamp
- previous state where appropriate
- new state where appropriate
- request ID
- IP where appropriate
- user agent where appropriate

Never store secrets or sensitive credentials in audit logs.

---

# EVENT SYSTEM

Implement a typed internal event system.

Events must support:

- event ID
- event type
- version
- timestamp
- tenant
- restaurant
- branch
- actor
- payload
- correlation ID
- causation ID

Implement idempotency where required.

---

# NOTIFICATION FOUNDATION

Create a notification abstraction supporting:

- in-app notifications
- email
- SMS
- WhatsApp
- push notifications

Do not tightly couple notification logic to providers.

---

# FEATURE FLAGS

Implement feature flags for:

- tenant
- restaurant
- branch
- environment

---

# SECURITY

Implement automated security tests for:

- unauthorized access
- cross-tenant access
- privilege escalation
- invalid tokens
- expired sessions
- malformed input
- injection attempts
- insecure file upload
- rate limiting
- webhook authentication

---

# TESTING

Create:

Unit tests
Integration tests
API tests
RBAC tests
Tenant isolation tests
E2E authentication tests

Also create:

/docs/testing/manual/FOUNDATION_MANUAL_TEST.md

The manual checklist must include exact steps and expected results.

---

# ACCESSIBILITY

Verify:

- keyboard navigation
- focus states
- semantic HTML
- labels
- ARIA only when required
- color contrast
- screen reader compatibility

---

# SEO

Implement the public SEO foundation:

- metadata framework
- sitemap
- robots.txt
- canonical URLs
- Open Graph
- structured metadata

Prevent authenticated/private pages from being indexed.

---

# DOCUMENTATION

Update all relevant documentation.

Create an ADR for major architectural decisions.

Do not leave TODO comments for functionality that should be implemented.

Run the complete automated test suite.

Fix all failures.

Only mark the phase complete when:

- automated tests pass
- manual test plan is complete
- security tests pass
- documentation is updated
- build passes
- lint passes
- type checking passes