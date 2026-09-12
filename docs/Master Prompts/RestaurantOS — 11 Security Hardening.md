# RestaurantOS — Security Hardening Phase

Perform a complete security audit.

---

# APPLICATION SECURITY

Test:

Authentication
Authorization
RBAC
Tenant isolation
IDOR
CSRF
XSS
SQL injection
Command injection
SSRF
Path traversal
File upload
Session attacks
Brute force
Rate limiting
Webhook attacks
Replay attacks

---

# DATA SECURITY & PRIVACY (PHASE 00 Sections 31 & 42)

Review:

- secrets & credentials
- environment variables
- audit logs (ensure zero credential leakage)
- customer CRM data
- addresses & gate codes
- payment information (PCI-DSS tokenization; never store raw CVV/card numbers)
- call recordings & SIP metadata

Driver Data Minimization (PHASE 00 Section 31):
- Enforce `DeliveryViewDTO`: Couriers only receive delivery address, display name, and access notes.
- Strictly block drivers from viewing customer order history, total spend, or CRM tags.

Fleet Telemetry Privacy (PHASE 00 Section 42):
- Telemetry collection is restricted to active driver shifts (`ON_SHIFT`).
- Telemetry database retention is enforced at 30 days via automated range partitioning.
- Strictly prohibit unrestricted personal tracking outside of working shifts.

---

# REALTIME WEBSOCKET SECURITY (PHASE 00 Sections 28 & 29)

Audit:
- Ephemeral single-use ticket handshake (`POST /api/v1/realtime/ticket` with 60s TTL).
- Block long-lived JWTs in URL query strings.
- Enforce channel authorization boundaries:
  - `kds:{branch_id}`
  - `dispatch:{branch_id}`
  - `driver:{driver_id}`
  - `vehicle_telemetry:{branch_id}`
  - `public_tracking:{delivery_id}`
  - `admin:{tenant_id}`

---

# API SECURITY

Check:

- authentication
- authorization
- validation
- pagination
- rate limits
- error leakage
- CORS
- API keys

---

# DEPENDENCY SECURITY

Audit dependencies for known vulnerabilities.

Update safe versions where compatible.

Document exceptions.

---

# SECURITY TESTS

Add automated regression tests for every discovered vulnerability.

Create:

/docs/security/SECURITY_AUDIT.md

No critical/high severity issue may remain without an explicit documented exception.