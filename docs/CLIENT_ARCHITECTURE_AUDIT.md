# RestaurantOS — Master Client Architecture Audit

**Document ID:** `DOC-AUDIT-CLIENT-001`  
**Version:** `1.0.0`  
**Phase:** Phase 13 Pre-Implementation Audit  
**Status:** Approved  
**Author:** Lead Enterprise Systems Architect  

---

## 1. Executive Summary

This audit assesses the current state of client surfaces, API integration points, authentication and authorization boundaries, realtime infrastructure, and client contracts across the **RestaurantOS** repository prior to executing Phase 13 (Multi-Client Architecture & Client Boundary Completion).

The codebase currently possesses a rich modular backend, comprehensive domain entities, 314 automated unit/integration/security tests, and three web-based UI surfaces:
1. **Web Admin / Operations Dashboard** (`src/app/page.tsx`)
2. **Self-Service Kiosk** (`src/app/kiosk/[branchId]`)
3. **Customer Ordering Web Storefront** (`src/app/r/[slug]`)

However, client boundaries have historically developed in an ad-hoc manner with direct embedded logic, missing a formalized, platform-neutral API client, lacking structured realtime resynchronization, and without formal contract guarantees for the upcoming native mobile clients (**Restaurant Manager Android**, **Driver Android**, and **Dedicated KDS UI**).

---

## 2. Existing Clients & UI Surfaces Audit

| Client Surface | Physical Target | Route / Location | Implementation Style | State Management | Current Communication Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Restaurant Web Admin** | Desktop / Tablet Web Browser | `src/app/page.tsx` | Single Next.js client component (3,700+ LOC) with 10 operational tabs | Local React `useState` / demo mock fixtures | Direct component state; mock simulation pipelines |
| **Self-Service Kiosk** | Large Touchscreen (Portrait / Landscape) | `src/app/kiosk/[branchId]` | Next.js App Router sub-tree (`menu`, `checkout`, `confirm`) | Component state, local storage / URL params | Ad-hoc `fetch('/api/v1/public/menu?branchId=...')`, `fetch('/api/v1/public/checkout')` |
| **Customer Web Storefront** | Mobile Web / Responsive Desktop | `src/app/r/[slug]` | Next.js App Router sub-tree (`menu`, `order`, `checkout`, `track/[orderId]`) | React context, Cart state | Ad-hoc `fetch('/api/v1/public/menu')`, `fetch('/api/v1/public/checkout')`, polling tracker |
| **Restaurant Manager Mobile App** | Android Phone / Tablet | *Not Yet Implemented* (Target: Prompt 14) | Target: Native Android (React Native / Kotlin) | Target: Local SQLite / offline sync | Target: Unified RestaurantOS API Client + Realtime |
| **Driver Mobile App** | Android Smartphone | *Not Yet Implemented* (Target: Prompt 15) | Target: Native Android (React Native / Kotlin) | Target: Local state + GPS telemetry service | Target: Minimal `DeliveryViewDTO` + Driver Channel |
| **Kitchen Display System (KDS)** | Kitchen Touch Monitors / Android TV | Partial demo in Web Admin tab | Target: Dedicated full-screen client (Target: Prompt 16) | Target: Local station state rail | Target: Ticketed WebSocket channel + snapshot recovery |

---

## 3. Backend Services & Domain Subsystems Audit

The backend is organized as a Clean Modular Monolith under `src/modules/` and `src/core/`:

1. **`identity`** (`src/modules/identity`):
   - Multi-tenant hierarchy: `organizations` $\rightarrow$ `restaurants` $\rightarrow$ `branches`.
   - Granular RBAC (`src/modules/identity/domain/rbac.ts`) defining 12 core roles and 50+ fine-grained permissions.
   - Session & token authentication service (`auth-service.ts`) with password hashing, reset tokens, and session expiration.
   - Middleware guard (`auth-guard.ts`) resolving `AuthContext` from Bearer tokens, HTTP-only cookies, and branch headers.

2. **`orders`** (`src/modules/orders`):
   - Universal Order finite state machine (`DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `IN_PREPARATION` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED`).
   - Pricing calculations, tax breakdown, modifiers, and payment status tracking.

3. **`delivery`** (`src/modules/delivery`):
   - Independent Delivery lifecycle (`WAITING` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `AVAILABLE_FOR_ASSIGNMENT` $\rightarrow$ `ASSIGNED` $\rightarrow$ `PICKED_UP` $\rightarrow$ `OUT_FOR_DELIVERY` $\rightarrow$ `ARRIVED_AT_CUSTOMER_AREA` $\rightarrow$ `DELIVERED`).
   - Real-time Driver Availability Queue ordered strictly by `available_since ASC`.
   - Atomic driver self-assignment with database row-level locking.
   - Smart Batching heuristic engine with manager approval workflow.

4. **`fleet`** (`src/modules/fleet`):
   - Vehicle and tracker telemetry domain.
   - GPS telemetry ingestion, battery tracking, and spatial geofence crossing triggers.

5. **`kds`** (`src/modules/kds`):
   - Station routing (Grill, Salad, Fryer, Pizza, Expo).
   - SLA timers and dynamic preparation duration estimates.

6. **`inventory`** (`src/modules/inventory`):
   - Warehouse stock levels, multi-unit conversions, recipe BOM depletion policies, and kitchen waste logging.

7. **`crm` & `marketing`** (`src/modules/crm`, `src/modules/marketing`):
   - Customer profiles, geocoded addresses, loyalty tiers, promotional rules, and coupon redemptions.

8. **`realtime`** (`src/modules/realtime`):
   - Ephemeral ticket generation (`POST /api/v1/realtime/ticket`) with 60-second TTL.
   - Channel access validation by role and station.

9. **`notifications`** (`src/modules/notifications`):
   - Multi-channel notification dispatcher (`IN_APP`, `EMAIL`, `SMS`, `WHATSAPP`, `PUSH`).

10. **`core`** (`src/core/database`, `src/core/events`, `src/core/security`):
    - Hybrid database abstraction: In-memory repository with deep SQL compatibility for testing, and PostgreSQL pool for production.
    - Transactional Outbox event bus.
    - Webhook cryptographic verifiers (HMAC-SHA256) and magic number file upload sanitizers.

---

## 4. Authentication & Authorization Flows

### 4.1 Authentication Flow
- **Web Admin**: Uses JWT Bearer token or `restaurant_os_session` HTTP-only cookie.
- **Kiosk**: Public branch initialization or device-level token pairing with transient guest checkout sessions.
- **Customer Web**: Unauthenticated guest session with optional phone/SMS OTP verification during checkout.
- **Future Mobile Clients (Manager / Driver / KDS)**:
  - Manager: User/password or Staff PIN login generating standard JWT Bearer token with refresh token rotation.
  - Driver: Phone number + PIN or driver credentials generating a scoped session strictly bounded to their driver ID and assigned branch.
  - KDS: Device-level activation token paired with specific station ID (`station_id`).

### 4.2 Authorization Flow
- Authorization is strictly enforced **server-side** in route handlers and service methods via `auth-guard.ts` and `rbac.ts`.
- `X-Client-Type` (`WEB_ADMIN`, `MANAGER_APP`, `DRIVER_APP`, `KDS_UI`, `KIOSK`, `CUSTOMER_WEB`) is sent in request headers for routing context and operational telemetry, but **is never trusted as an authorization boundary**.
- A client cannot elevate privileges simply by modifying `X-Client-Type`.

---

## 5. API & Realtime Communication Patterns

### 5.1 REST API Conventions
- Base path: `/api/v1/*`.
- Required tenant headers: `X-Tenant-ID`, `X-Branch-ID`.
- Request tracking: `X-Request-ID`.
- Mutation protection: `Idempotency-Key` header for state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- Error protocol: RFC 7807 structured JSON (`{ success: false, error: { code, message, details, requestId, timestamp } }`).

### 5.2 Realtime Architecture
- Protocol: Ticketed WebSocket / SSE.
- Handshake: Client requests ticket via `POST /api/v1/realtime/ticket` with session credentials; server verifies permissions and generates single-use ticket in Redis/Memory with 60s TTL; client connects to `/api/v1/realtime?ticket=...`.
- Channels:
  - `branch:<id>:kds:<station>` (Line cooks, kitchen staff)
  - `branch:<id>:dispatch` (Managers, dispatchers)
  - `driver:<id>:deliveries` (Authenticated driver only)
  - `order:<id>:tracking` (Public anonymized order tracker)
  - `branch:<id>:telemetry` (Fleet managers)

---

## 6. Current Gaps, Duplications & Risks

### 6.1 Gaps
1. **No Shared API Client**: Frontend pages currently use ad-hoc native `fetch()` calls without standardized request interceptors, exponential backoff, or RFC 7807 error parsing.
2. **Missing Network Retry & Idempotency Key Semantics**: Ad-hoc fetches do not reuse idempotency keys during retries, creating risk of duplicate submissions upon network timeouts.
3. **No Offline Replay Protection**: No formal classification distinguishing safe read operations from unsafe state-changing mutations (e.g. driver assignment, order state progression).
4. **No Realtime Snapshot Reconciliation**: Reconnecting WebSockets currently do not fetch an authoritative server snapshot, risking silent local state divergence when events are dropped during disconnections.
5. **No Platform-Neutral Abstraction Layer**: Existing code references browser-specific objects (`window`, `localStorage`) in places, preventing direct reuse in native mobile apps without refactoring.

### 6.2 Duplications
- Order formatting and status badge styles are duplicated across `src/app/page.tsx`, `KioskComponents.tsx`, and `OrderStatusTracker.tsx`.
- Cart calculation logic exists separately in the Kiosk checkout page and the Customer Web checkout page.

### 6.3 Risks
- **Privilege Escalation Risk**: If client types were ever trusted for access decisions, any attacker could spoof headers. This must be mathematically prevented by enforcing session-derived RBAC.
- **Driver Data Leakage**: If the Driver App receives the full `Delivery` entity rather than `DeliveryViewDTO`, customer CRM history, kitchen preparation details, and supplier costs could be leaked to drivers.
- **Split-Brain Reconnects**: If a KDS or Manager screen disconnects during peak rush and reconnects without snapshot resynchronization, missed order cancellations or priority escalations could lead to wasted food or delayed delivery.

---

## 7. Action Plan for Phase 13

1. **Shared Contracts (`src/shared/contracts/`)**: Export canonical, pure TypeScript types for all entities, response envelopes, error codes, and the driver-minimized `DeliveryViewDTO`.
2. **Platform-Neutral API Client (`src/shared/api-client/`)**: Provide a zero-DOM, pluggable HTTP client with automatic contextual headers, retry policies, key reuse across retries, and offline safety checks.
3. **Realtime Client Manager (`src/shared/realtime/`)**: Implement ticket handshakes, reconnection lifecycles, and snapshot reconciliation protocols.
4. **Master Architecture Documentation (`docs/CLIENT_ARCHITECTURE.md`)**: Formally document the 6 client boundaries, capability matrix, and security models.
5. **Verification Test Suite (`tests/unit/client-architecture.spec.ts`, `tests/security/client-boundaries.spec.ts`)**: Verify security invariants, isolation, idempotency, and portability.
