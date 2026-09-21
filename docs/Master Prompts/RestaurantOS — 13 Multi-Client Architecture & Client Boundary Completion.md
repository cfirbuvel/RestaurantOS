# RestaurantOS — Prompt 13

## Multi-Client Architecture & Client Boundary Completion

You are continuing development of the existing RestaurantOS repository.

IMPORTANT:

This is NOT a new project.

Do NOT restart the project.
Do NOT rewrite existing modules.
Do NOT replace working implementations.
Do NOT go back to Phase 0.
Do NOT invalidate previously completed phases.

The repository already contains substantial backend/domain/API/web functionality, including:

* Multi-tenant architecture
* Authentication and authorization
* Orders
* Delivery
* Drivers backend/API
* Fleet/tracker backend
* KDS backend/API
* Kiosk
* Customer ordering website
* Restaurant web application/dashboard
* Inventory
* Customers
* Analytics
* Integrations
* Realtime infrastructure
* Security architecture
* Tests
* Documentation

The goal of this phase is to formally establish RestaurantOS as a multi-client platform.

---

# 1. First: Inspect Before Changing Anything

Inspect the current repository.

Read at minimum:

* README
* ARCHITECTURE
* API
* DATABASE
* SECURITY
* SECURITY_ARCHITECTURE
* TESTING
* IMPLEMENTATION_STATUS
* ROADMAP
* relevant ADRs
* existing package configuration
* existing frontend architecture
* existing API client implementation
* authentication implementation
* realtime implementation

Also inspect:

* src/app
* src/components
* src/modules
* tests
* docs

Identify what already exists.

Create:

`docs/CLIENT_ARCHITECTURE_AUDIT.md`

Include:

* existing clients
* existing UI surfaces
* existing backend services
* reusable packages/components
* authentication flow
* authorization flow
* API communication
* realtime communication
* notification infrastructure
* current gaps
* duplicated functionality
* risks

Do not modify implementation until the audit is complete.

---

# 2. Official Client Model

Establish the following conceptual architecture:

```text
                         RestaurantOS Platform
                                  |
                 +----------------+----------------+
                 |                |                |
              Backend          Realtime          Events
                 |
      +----------+----------+----------+----------+
      |          |          |          |          |
     Web       Manager    Driver      KDS      Kiosk
    Admin       App        App        UI
      |
 Customer Web
```

Clients:

1. Restaurant Web Admin
2. Restaurant Manager Mobile App
3. Driver Mobile App
4. KDS Client
5. Kiosk Client
6. Customer Ordering Web

Future clients must be able to use the same contracts.

---

# 3. Establish Client Boundaries

Define responsibilities.

## Web Admin

Primary use:

* configuration
* advanced management
* reporting
* inventory
* products
* users
* integrations
* system administration
* advanced operational workflows

## Manager App

Primary use:

* live operations
* orders
* delivery
* drivers
* KDS overview
* alerts
* approvals
* quick operational actions
* branch management

## Driver App

Primary use:

* shift
* availability
* assigned delivery
* self-assignment
* navigation
* customer contact
* delivery completion
* return to restaurant
* notifications

## KDS

Primary use:

* kitchen tickets
* preparation state
* timers
* SLA
* station workflow

## Kiosk

Primary use:

* customer self-ordering

## Customer Web

Primary use:

* browse menu
* ordering
* payment
* order tracking

---

# 4. Shared Contracts

Do NOT duplicate business logic between clients.

Business rules must remain server-side.

Create or formalize shared contracts for:

* authentication
* users
* tenants
* restaurants
* branches
* roles
* permissions
* orders
* deliveries
* drivers
* vehicles
* KDS tickets
* customers
* notifications
* realtime events
* errors
* pagination
* idempotency

If TypeScript shared types already exist, extend them.

Do not introduce a second competing contract system.

---

# 5. Shared Client Infrastructure

Determine what can safely be shared between clients.

Potential shared packages:

```text
packages/
  api-client/
  contracts/
  auth/
  realtime/
  notifications/
  validation/
  design-tokens/
```

Do not create packages merely for theoretical cleanliness.

Only extract code where there is a real reuse requirement.

---

# 6. API Client

Create or formalize a consistent API client.

Requirements:

* authentication
* tenant context
* branch context
* request IDs
* Idempotency-Key where required
* standardized errors
* timeout handling
* retry policy
* refresh/session handling
* offline-aware behavior
* logging without sensitive data

The mobile applications must never directly access the database.

---

# 7. Realtime

Formalize realtime channels.

Existing WebSocket/SSE infrastructure must be reused.

Define client subscriptions for:

* orders
* deliveries
* drivers
* KDS
* notifications
* fleet status
* operational alerts

Every realtime event must be tenant/branch scoped.

No client may receive another tenant's events.

---

# 8. Authentication

Document and standardize authentication for:

### Web

Existing web authentication.

### Manager App

Manager/staff authentication.

### Driver App

Driver authentication.

### KDS

Station/device authentication.

### Kiosk

Kiosk/device/session authentication.

Never create separate insecure authentication mechanisms simply because the client is mobile.

---

# 9. Authorization

Authorization remains server-side.

Clients may hide unavailable actions for UX, but backend authorization is authoritative.

Ensure:

* tenant isolation
* branch isolation
* role permissions
* driver ownership rules
* manager permissions
* KDS permissions
* device permissions

---

# 10. Documentation

Create:

`docs/CLIENT_ARCHITECTURE.md`

Include:

* client map
* responsibilities
* authentication
* authorization
* API communication
* realtime
* notifications
* shared contracts
* offline model
* deployment model
* future clients

Create/update:

`docs/IMPLEMENTATION_STATUS.md`

Do not mark future clients complete.

---

# 11. Tests

Add tests for:

* tenant isolation
* branch isolation
* authorization
* API contract compatibility
* realtime authorization
* invalid client context
* expired authentication
* duplicate/idempotent requests

Run:

* unit tests
* integration tests
* type checking
* lint
* build

Do not proceed if existing functionality regresses.

---

# Definition of Done

The repository has a clear and documented multi-client architecture.

Existing functionality continues working.

No duplicate business logic is introduced.

Manager App, Driver App and KDS are clearly defined as clients that will be implemented in subsequent prompts.

Stop after this phase and provide:

1. files changed
2. architecture decisions
3. tests executed
4. test results
5. remaining gaps
6. exact recommended next prompt
