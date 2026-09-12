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

# DATA SECURITY

Review:

- secrets
- environment variables
- logs
- customer data
- addresses
- driver data
- payment information
- call information

Never store sensitive payment credentials unless explicitly required and properly secured.

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