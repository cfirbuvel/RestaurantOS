# RestaurantOS — Prompt 20

## Multi-Client Production Hardening

This phase is a production-readiness pass.

Do not add major new features.

Do not rewrite architecture.

Do not refactor working code merely for style.

Focus on reliability, security, observability and deployment.

---

# 1. Security Audit

Review:

* authentication
* authorization
* tenant isolation
* RLS
* API validation
* mobile token storage
* secrets
* push notification payloads
* location data
* customer PII
* access codes
* audit logging

---

# 2. Mobile Security

Check:

* secure storage
* session expiration
* logout
* revoked sessions
* no sensitive logs
* screenshot considerations where appropriate
* background data exposure
* debug builds cannot access production credentials

---

# 3. API Reliability

Check:

* idempotency
* retries
* timeouts
* conflict handling
* rate limits
* transaction boundaries
* outbox
* duplicate events

---

# 4. Realtime Reliability

Test:

* disconnect
* reconnect
* duplicate events
* delayed events
* missed events
* unauthorized subscriptions

---

# 5. Observability

Ensure useful telemetry exists for:

* API failures
* client crashes
* authentication failures
* realtime disconnects
* integration failures
* notification failures
* delivery assignment conflicts

Never log sensitive customer data unnecessarily.

---

# 6. Performance

Measure:

* initial web load
* mobile startup
* API latency
* KDS event latency
* realtime propagation
* database queries

Do not optimize based only on assumptions.

---

# 7. Build Pipelines

Ensure:

Web:

* lint
* typecheck
* test
* build

Android:

* analyze
* test
* build debug
* build release where signing infrastructure exists

Never commit signing keys.

---

# 8. Documentation

Update:

* README
* ARCHITECTURE
* IMPLEMENTATION_STATUS
* DEPLOYMENT
* OPERATIONS
* SECURITY
* TESTING
* CLIENT_ARCHITECTURE
* MANAGER_APP
* DRIVER_APP

Document what is actually implemented.

Do not claim production readiness without evidence.

---

# Final Report

Generate:

`docs/MULTI_CLIENT_PRODUCTION_READINESS_REPORT.md`

Include:

* features verified
* tests executed
* known limitations
* security findings
* performance findings
* deployment status
* mobile build status
* unresolved issues
* recommended next phase
