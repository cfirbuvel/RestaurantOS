# RestaurantOS — Master Security Hardening & Compliance Audit

**Document ID:** `AUD-SEC-2026-001`  
**Phase:** 11 — Security Hardening & Production Audit  
**Canonical Status:** Fully Audited & Hardened  
**Audit Completion Date:** September 19, 2026  
**Classification:** Enterprise SaaS Security & Compliance Standard  
**Governing Baseline:** `docs/Master Prompts/RestaurantOS — 11 Security Hardening.md` & `PHASE 00.md` (Sections 28, 29, 31, 32, 42)

---

## 1. Executive Summary

RestaurantOS has undergone a comprehensive, multi-layered security audit and hardening cycle. This assessment examined the application across core threat domains: Application Security, Identity and Access Management (Authentication & RBAC), Multi-Tenant Isolation, Real-Time Channel Security, Data Minimization & Privacy, Dependency Health, and External Integration Integrity.

All 17 application security attack vectors specified in the Phase 11 charter and the architectural contracts defined in Phase 00 have been audited, mitigated, and verified with automated regression tests.

### Key Audit Findings & Hardening Status:
- **Total Security Tests Executed:** 57 automated security assertions (including 18 dedicated Phase 11 master regression tests).
- **Test Suite Pass Rate:** 100% (296/296 passing across all 38 test suites, 0 failures).
- **TypeScript Typecheck Status:** Zero compilation errors (`tsc --noEmit`).
- **Critical / High Vulnerabilities:** 0 unmitigated production vulnerabilities. All third-party development dependencies with reported advisories have been triaged with documented exceptions and risk mitigations.

---

## 2. Threat Modeling Assessment (STRIDE)

| Threat Category | Potential Attack Vector | Applied Platform Safeguard | Audit Verification Status |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Forging driver identity, session hijacking, or WebSocket impersonation. | Bcrypt/Argon2id salted password hashing; ephemeral single-use WebSocket tickets (60s TTL); session revocation via token blacklist/deletion. | **VERIFIED PASS** (`auth-service.ts`, `realtime-service.ts`) |
| **Tampering** | Modifying menu prices during checkout, manipulating coupon discounts, or altering delivery timestamps. | Server-authoritative price calculation (ignoring client payloads); database-calculated promotional deductions; append-only outbox event streams. | **VERIFIED PASS** (`checkout-service.ts`, `order-service.ts`) |
| **Repudiation** | Staff denying order cancellations, refunds, or driver delivery reassignments. | Immutable `audit_logs` capturing actor ID, actor type, IP address, timestamp, state diff, and requestId. | **VERIFIED PASS** (`audit-logger.ts`) |
| **Information Disclosure** | Cross-tenant order leaks, driver accessing full CRM data, or credential leakage in system logs. | PostgreSQL RLS + tenant context scoping; `DeliveryViewDTO` PII masking; `REDACTED_KEYS` credential sanitization in audit logs. | **VERIFIED PASS** (`customer.ts`, `delivery-service.ts`, `audit-logger.ts`) |
| **Denial of Service** | Flooding public order endpoints, webhook receivers, or login endpoints. | Redis token-bucket rate limiting (`RateLimiter`); payload size caps (10MB for file uploads); Next.js route edge protections. | **VERIFIED PASS** (`rate-limiter.ts`, `public-ordering-security.spec.ts`) |
| **Elevation of Privilege** | Cashier or Driver calling Manager batch approval or finance EOD endpoints. | Strict server-side permission gates (`@verifyPermission`, `ROLE_PERMISSIONS`); negative boundary checks for cross-tenant entity linkage. | **VERIFIED PASS** (`auth-guard.ts`, `rbac.ts`) |

---

## 3. Application Security Vector Audit

### 3.1 Authentication & Session Attacks
- **Audit Findings:** Session tokens are cryptographically random (256-bit entropy). Passwords use bcrypt with salt rounds >= 10. Passwords are never returned in user queries.
- **Session Revocation:** Calling `authService.revokeSession(token)` immediately deletes the session from the active cache/table, preventing session reuse.
- **Brute Force Protection:** Login attempts and password resets are rate-limited per IP/user key via Redis.

### 3.2 Authorization & RBAC Privilege Escalation
- **Role Hierarchy:** Roles (`OWNER`, `ADMIN`, `MANAGER`, `KITCHEN_MANAGER`, `KITCHEN_EMPLOYEE`, `CASHIER`, `DELIVERY_MANAGER`, `DRIVER`, `VIEWER`) are mapped to granular permissions in `src/modules/identity/domain/rbac.ts`.
- **Verification:** Drivers and Cashiers attempting to access `delivery.manage`, `promotions.manage`, or `billing.manage` are strictly rejected with HTTP `403 Forbidden`. Managers have operational dispatch access (`delivery.manage`) but cannot alter system-wide root admin settings.

### 3.3 Multi-Tenant Isolation & IDOR Protection (PHASE 00 Section 32)
- **Data Isolation:** All database tables (`orders`, `deliveries`, `customers`, `products`, `vehicles`, `trackers`) enforce `tenant_id` scoping.
- **Negative Boundary Validation:** If Tenant A attempts to read or mutate Tenant B records (e.g. `memoryDb.findById("orders", "ord-tenant-a-101")` executed in Tenant B context), the lookup returns `null` or throws an authorization error.
- **Composite Foreign Key Integrity:** In `deliveryService.assignDelivery`, cross-tenant entity linking is strictly prohibited: assigning a driver belonging to Tenant B to a delivery belonging to Tenant A fails immediately (`Driver not found or does not belong to tenant`).

### 3.4 Injection Vulnerabilities (SQLi, Command Injection, SSRF, Path Traversal)
- **SQL Injection:** All PostgreSQL database interactions utilize parameterized queries (`$1`, `$2`, ...). In-memory mock database uses structured TypeScript predicate filters.
- **Command Injection:** No user-controlled input traverses system shells (`exec`, `spawn`).
- **Server-Side Request Forgery (SSRF):** Webhook dispatchers and PBX telephony bridges reject private and loopback IP ranges (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`).
- **Path Traversal:** File uploads are validated via `file-validator.ts`. Sanitization removes all directory traversal sequences (`../`, `..\\`), root slashes, and null bytes (`\0`).

### 3.5 File Upload Validation
- **Magic Number Inspection:** Content inspection detects true MIME types via initial header bytes (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `%PDF` for PDF). Executable payloads masquerading with `.png` extensions are rejected with `Unable to identify file type from content. Upload rejected.`.
- **Size & Extension Limits:** 10MB maximum file size is enforced; extension allowlist restricts uploads to safe image and document types.

### 3.6 Webhook Security & Replay Attacks
- **HMAC Signature Verification:** Webhooks from Wolt, 10bis, and PBX trunks are signed using HMAC-SHA256.
- **Timing Oracle Defense:** Signatures are compared using `crypto.timingSafeEqual` to avoid timing side-channel leaks.
- **Replay Protection:** Webhook requests older than 300 seconds (5 minutes) based on request timestamp headers are rejected as stale.

---

## 4. Real-Time WebSocket & Channel Security (PHASE 00 Sections 28 & 29)

### 4.1 Ephemeral Handshake (`POST /api/v1/realtime/ticket`)
- **Prohibition of Query JWTs:** Long-lived JWTs and session tokens in WebSocket URL query strings (e.g., `/ws?token=...`) are blocked to prevent token leakage in HTTP access logs and proxy caches.
- **Two-Step Ticket Architecture:**
  1. Client sends authenticated `POST /api/v1/realtime/ticket`.
  2. Server generates single-use ticket (`tk_<hex24>`) with 60-second TTL stored in Redis/DB.
  3. Client connects to WebSocket with `?ticket=tk_...`.
  4. Server atomically consumes and burns the ticket (`used_at = NOW()`). Replaying the ticket throws `Ticket has already been consumed (single-use)`.

### 4.2 Channel Authorization Boundaries
Realtime subscriptions are strictly bound to authenticated roles and identities:
- `kds:{branch_id}` / `branch:{branch_id}:kds:...`: Accessible to `LINE_COOK`, `KITCHEN_EMPLOYEE`, `KITCHEN_MANAGER`, `MANAGER`, `ADMIN`.
- `dispatch:{branch_id}` / `branch:{branch_id}:dispatch`: Accessible to `DELIVERY_MANAGER`, `MANAGER`, `ADMIN`.
- `driver:{driver_id}`: Accessible **only** to the authenticated driver matching `userId === driver_id`. Drivers cannot subscribe to other drivers' channels.
- `vehicle_telemetry:{branch_id}`: Strictly restricted to `FLEET_MANAGER`, `DELIVERY_MANAGER`, `ADMIN`. Strictly blocked for `DRIVER`, `LINE_COOK`, `CASHIER`.
- `public_tracking:{delivery_id}`: Public order tracking channel token-gated strictly to the delivery in transit.
- `admin:{tenant_id}`: Strictly restricted to `ADMIN` and `OWNER`.

---

## 5. Data Security & Privacy Compliance

### 5.1 Driver Data Minimization (`DeliveryViewDTO` - PHASE 00 Section 31)
- **Problem Statement:** Couriers must not have access to full CRM customer dossiers, customer lifetime spend, order frequencies, or customer tags.
- **Safeguard:** `deliveryService.toDeliveryViewDTO` and `customerService.toDeliveryViewDTO` mask sensitive customer PII:
  - Allowed fields: delivery destination (street, house number, entrance, floor, gate code), recipient display name, and masked phone (`050-***1234`).
  - Redacted fields: total lifetime spend, historical orders, internal kitchen notes, customer CRM tags (`VIP`, `COMPLAINER`), payment card identifiers.

### 5.2 Fleet Telemetry Privacy & Data Retention (PHASE 00 Section 42)
- **Shift-Bound Telemetry:** Vehicle location tracking is restricted to operational delivery shifts. If a vehicle is assigned to a driver whose shift status is `OFF_SHIFT` (or unassigned when strict shift checks are enabled), location ingestion is rejected with `TELEMETRY_PRIVACY_VIOLATION: Telemetry collection rejected outside active driver shift`. Continuous personal employee surveillance is prohibited.
- **30-Day Automated Retention:** `fleetService.purgeStaleTelemetry(tenantId, 30)` purges GPS location packets older than 30 days.

### 5.3 Zero Credential Leakage in Audit Logs
- **Sanitization:** `src/core/audit/audit-logger.ts` enforces automated recursive redaction for all sensitive keys:
  - `password`, `password_hash`, `pin`, `pin_code_hash`
  - `token`, `session_token`, `access_token`, `refresh_token`, `authorization`, `bearer`
  - `secret`, `client_secret`, `api_key`, `api_secret`, `private_key`
  - `credit_card`, `card_number`, `pan`, `cvv`, `security_code`
  - `sip_password`
- Redacted fields are replaced with `[REDACTED]` prior to persistence in database storage.

### 5.4 Payment Security (PCI-DSS SAQ A)
- **Tokenized Gateways:** No primary account numbers (PAN), expiration dates, or CVV codes traverse or reside in RestaurantOS storage. Card payments are tokenized client-side via gateway iframes / hosted tokenizers (Meshulam, Stripe Elements, Wolt Pay, Tenbis).
- Database entities store only gateway transaction tokens (`token_xyz`) and authorization IDs.

### 5.5 Israeli Wiretap Law (חוק האזנת סתר, התשל"ט-1979) Telephony Compliance
- Telephony ingestion records require that inbound callers receive an automated recorded disclosure stating that calls may be recorded for customer service monitoring (`automated_greeting_played: true`).
- SIP webhook credentials require HMAC token verification; duplicate sessions are rejected via composite idempotency keys.

---

## 6. HTTP Security Headers & Infrastructure

`next.config.ts` enforces the following security headers on all application and API routes:
- **Strict-Transport-Security (HSTS):** `max-age=63072000; includeSubDomains; preload`
- **Content-Security-Policy (CSP):** `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' ws: wss: https:; frame-ancestors 'none';`
- **X-Frame-Options:** `DENY` (clickjacking defense)
- **X-Content-Type-Options:** `nosniff` (MIME-sniffing prevention)
- **X-XSS-Protection:** `1; mode=block`
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **Permissions-Policy:** `camera=(), microphone=(), geolocation=(self)`
- **X-Robots-Tag:** `noindex, nofollow` on backoffice, API, POS, and KDS endpoints.

---

## 7. Dependency Security & Documented Exceptions

A full dependency audit was executed via `npm audit --json`.

### Triage Matrix & Documented Exceptions:

| Dependency | Severity | CVE / Advisory | Impact on Production | Status / Documented Exception |
| :--- | :--- | :--- | :--- | :--- |
| `postcss` (via `next`) | High | `GHSA-r28c-9q8g-f849`<br>`GHSA-6g55-p6wh-862q` | None in Production. Path traversal / CSS source map auto-loading affects development build CSS parsing tools when attacker controls `sourceMappingURL` comments in untrusted CSS stylesheets. | **EXCEPTION DOCUMENTED:** PostCSS is a build-time build dependency. RestaurantOS compiles CSS strictly from internal trusted source files (`globals.css`, Tailwind CSS). In production runtime, Next.js serves pre-compiled static CSS assets. No user-supplied CSS is processed by PostCSS. Upgrade to Next.js 16.x is scheduled for the next major release window. |
| `vitest` / `@vitest/mocker` | Moderate | `GHSA-82fw-gwwq-j7x9` | None in Production. Path traversal in `@vitest/mocker` test redirect mocks during Vitest test execution. | **EXCEPTION DOCUMENTED:** Vitest is classified strictly as a `devDependency` and is not bundled into the Next.js production server or runtime deployment artifact. |
| `next` | Moderate | `GHSA-qx2v-qp2m-jg93` | Transitive effect via PostCSS style stringify. | **EXCEPTION DOCUMENTED:** Same as PostCSS above. Covered by build-time asset isolation. |

---

## 8. Verification & Test Evidence

### Automated Test Suite Execution:
```bash
> restaurant-os@0.1.0 test
> vitest run

Test Files  38 passed (38)
     Tests  296 passed (296)
  Duration  5.92s
```

### TypeScript Validation:
```bash
> restaurant-os@0.1.0 typecheck
> tsc --noEmit

Exit code: 0
```

### Security Regression Suites:
1. `tests/security/phase-11-security-hardening.spec.ts` (18 master regression tests)
2. `tests/security/security-suites.spec.ts` (35 vector tests)
3. `tests/security/public-ordering-security.spec.ts` (4 vector tests)

---

## 9. Security Sign-Off

RestaurantOS satisfies all Phase 11 Security Hardening criteria and complies with the architectural requirements of Phase 00 (Sections 28, 29, 31, 32, and 42). The system is approved as hardened for production readiness.
