# RestaurantOS — Master Initialization & System Planning

You are the lead software architect responsible for initializing a production-grade SaaS platform called **RestaurantOS**.

RestaurantOS is a modular restaurant operating system designed to support:

- Restaurants
- Cafés
- Pizzerias
- Burger restaurants
- Sushi restaurants
- Asian restaurants
- Meat restaurants
- Ice cream shops
- Small businesses
- Multi-branch restaurants
- Restaurant chains

The platform must be designed as a multi-tenant SaaS from day one.

---

## CRITICAL PRODUCT PRINCIPLE

Generation 1 is HUMAN OPERATED.

Do NOT build autonomous AI agents into the operational workflow.

The architecture must, however, be designed so that future generations can introduce:

- Machine learning
- AI recommendations
- AI Copilot
- Agentic workflows
- Autonomous operations

without requiring a complete architectural rewrite.

The future roadmap is:

Gen 1:
Human-operated RestaurantOS

Gen 2:
Smart automation and predictions

Gen 3:
AI Copilot

Gen 4:
Agentic RestaurantOS

Gen 5:
Highly autonomous restaurant operations

---

# FIRST TASK

Before writing or modifying application code:

1. Inspect the entire repository.
2. Identify the existing technology stack.
3. Identify existing modules.
4. Identify incomplete implementations.
5. Identify architectural problems.
6. Identify security risks.
7. Identify technical debt.
8. Identify missing tests.
9. Identify missing documentation.
10. Identify deployment configuration.
11. Identify database architecture.
12. Identify authentication and authorization.
13. Identify external integrations.
14. Determine whether the repository is empty, partially implemented, or already contains an application.

DO NOT blindly overwrite existing code.

Create:

/docs/PROJECT_AUDIT.md

---

# ARCHITECTURE REQUIREMENTS

Design the system around:

- Multi-tenancy
- Modular architecture
- Domain-driven boundaries
- Strong authorization
- Auditability
- Event-driven internal architecture
- Idempotent operations
- Observability
- Automated testing
- Security
- Extensibility
- API-first design
- Future AI compatibility

---

# REQUIRED CORE MODULES

The architecture must account for:

1. Authentication
2. Users
3. Organizations
4. Restaurants
5. Branches
6. Roles
7. Permissions
8. Employees
9. Customers / CRM
10. Addresses
11. Menu
12. Products
13. Categories
14. Modifiers
15. Orders
16. Payments
17. Delivery
18. Drivers & Driver Availability Queue
19. Delivery Batching
20. Kitchen Display System (KDS)
21. Vehicles (Fleet & Telematics)
22. Trackers (Fleet & Telematics)
23. Fleet Telemetry & Geofencing (Fleet & Telematics)
24. Telephony
25. Website Ordering
26. Kiosk
27. Inventory
28. Warehouse
29. Suppliers
30. Purchasing
31. Recipes / BOM
32. Stock Movements
33. Waste Tracking
34. Campaigns
35. Promotions
36. Coupons
37. Loyalty
38. Analytics
39. Reporting
40. Notifications
41. Integrations Hub
42. Audit Logs
43. System Settings
44. Restaurant Settings
45. Feature Flags
46. Billing / Subscriptions
47. Future AI / Intelligence Layer

---

# INTEGRATION HUB

Design an Integration Hub abstraction.

Potential integrations include:

- Wolt
- 10bis
- Mishloha
- Green Invoice
- Rivhit
- iCount
- Meshulam
- Stripe
- Payment providers
- SMS
- WhatsApp
- Email
- Telephony/SIP
- Maps
- POS systems

Never tightly couple business logic to a specific provider.

Use:

Provider Adapter
→ Integration Interface
→ Normalized RestaurantOS Model

---

# UNIVERSAL ORDER MODEL

Orders from:

- Website
- Kiosk
- POS
- Phone
- Wolt
- 10bis
- Mishloha
- Other integrations

must be normalized into a unified internal order model.

---

# EVENT SYSTEM

Design an internal event architecture.

Example events:

OrderCreated
OrderUpdated
OrderCancelled
OrderStarted
OrderReady
DriverAssigned
DeliveryCreated
DeliveryBatchSuggested
DeliveryBatchApproved
DeliveryBatchRejected
DeliveryDispatched
DeliveryCompleted
InventoryReceived
InventoryAdjusted
CouponRedeemed
PaymentCompleted
CustomerCreated

Events must be:

- typed
- versioned
- traceable
- auditable
- idempotent where appropriate

---

# FUTURE INTELLIGENCE

Design interfaces for:

Decision Engine
Recommendation Engine
Prediction Engine
Learning/Feedback Engine
Automation Policy Engine

Do not implement autonomous AI yet.

---

# DATABASE

Design a normalized multi-tenant database.

Every tenant-owned entity must have a clear tenant/organization relationship.

Define:

- primary keys
- foreign keys
- indexes
- unique constraints
- soft deletion strategy
- timestamps
- audit metadata
- tenant isolation strategy

Document the database architecture.

Create:

/docs/database/SCHEMA.md

---

# SECURITY

Security must be considered from day one.

Implement/document:

- authentication
- authorization
- RBAC
- tenant isolation
- input validation
- output validation
- rate limiting
- CSRF protection where relevant
- XSS prevention
- SQL injection prevention
- secure cookies
- secret management
- encryption strategy
- audit logs
- secure file uploads
- webhook verification
- API authentication
- session management
- password policies
- brute-force protection
- permission boundaries
- least privilege

Create:

/docs/security/SECURITY_ARCHITECTURE.md

---

# TESTING STRATEGY

Define:

- unit tests
- integration tests
- API tests
- database tests
- authorization tests
- tenant isolation tests
- E2E tests
- regression tests
- performance tests
- security tests
- accessibility tests
- manual test plans

Every future feature must have:

1. Automated tests
2. Manual test checklist
3. Acceptance criteria

Create:

/docs/testing/TESTING_STRATEGY.md

---

# DOCUMENTATION

Create:

/docs/README.md
/docs/PROJECT_AUDIT.md
/docs/ARCHITECTURE.md
/docs/PRODUCT_REQUIREMENTS.md
/docs/API.md
/docs/DATABASE.md
/docs/SECURITY.md
/docs/TESTING.md
/docs/DEPLOYMENT.md
/docs/OPERATIONS.md
/docs/INTEGRATIONS.md
/docs/ROADMAP.md

Also create ADRs for important architectural decisions.

---

# SEO

Although RestaurantOS is primarily an authenticated SaaS application, public-facing surfaces must support:

- SEO
- semantic HTML
- metadata
- Open Graph
- Twitter/X cards
- canonical URLs
- sitemap
- robots.txt
- structured data where appropriate
- accessibility
- fast loading
- Core Web Vitals

Authenticated dashboards do not need to be indexed.

---

# UX

The system must be:

- mobile-first
- tablet-friendly
- desktop-friendly
- responsive
- accessible
- fast
- operationally simple

Restaurant employees may use the system during busy periods.

Avoid unnecessary complexity.

---

# DESIGN PRINCIPLE

RestaurantOS should feel like:

"One operating system for the entire restaurant."

The UI should provide:

- clear hierarchy
- large operational controls
- minimal clicks
- obvious status
- strong visual feedback
- keyboard support where useful
- touch-friendly controls

---

# DEVELOPMENT PROCESS

Before implementing each module:

1. Define requirements.
2. Define architecture.
3. Define database changes.
4. Define API contracts.
5. Define security requirements.
6. Define tests.
7. Implement.
8. Run automated tests.
9. Perform manual testing.
10. Perform security review.
11. Update documentation.
12. Update changelog.
13. Update roadmap.

Never mark a task complete without evidence.

Create:

/docs/IMPLEMENTATION_STATUS.md

Track:

- completed
- partially completed
- blocked
- tested
- manually verified
- security reviewed
- documented

---

# FINAL OUTPUT

Do not immediately implement the entire product.

First produce the complete architecture, audit, roadmap, database design, module boundaries, testing strategy, security strategy and implementation plan.

Then stop.

Wait for the next implementation phase.