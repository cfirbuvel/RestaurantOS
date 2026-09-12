# RestaurantOS — Phase 8: Integration Hub

Build a provider-agnostic Integration Hub.

# INTEGRATION CLASSIFICATION (PHASE 00 Section 35)

Classify all integrations into two distinct architectural categories:

## 1. Core Business Integrations
External sales channels and Israeli fiscal/clearing providers:
- Wolt
- 10bis
- Mishloha
- Green Invoice
- Rivhit
- iCount
- Meshulam

## 2. Platform / Infrastructure Integrations
Supporting communications, maps, telephony, and IoT telematics:
- Stripe (Global payments)
- Twilio / Infobip (SMS / WhatsApp)
- Google Maps / Mapbox (Geocoding & distances)
- FreePBX / WebRTC (Telephony)
- **Fleet Tracker Providers (GPS / LTE hardware telematics)**

External provider formats must NEVER leak into the core domain! All providers must communicate via adapters and canonical DTOs.

---

# TRACKER PROVIDER ABSTRACTION (PHASE 00 Section 18)

Do NOT hard-code a specific GPS tracker hardware vendor.
Define an extensible adapter interface:
- `ITrackerAdapter` (`getDeviceStatus`, `getLatestLocation`, `subscribeToTelemetry`, `processWebhook`, `normalizeTelemetry`).
- Provide `MockTrackerAdapter` for deterministic development and automated testing.

---

# NORMALIZED INTEGRATION PIPELINE (PHASE 00 Section 36)

Every integration must follow the normalized pipeline:

```text
Receive Webhook / Inbound Payload
  ↓
Verify cryptographic signature (HMAC-SHA256)
  ↓
Verify timestamp (5-minute replay attack tolerance)
  ↓
Check idempotency key / Redis lock
  ↓
Transform external format
  ↓
Universal Canonical DTO
  ↓
Zod Schema Validation
  ↓
Persist to DB inside transaction
  ↓
Insert to Transactional Outbox
  ↓
Publish Domain Event
  ↓
Realtime WebSocket Dispatch
```

---

# WEBHOOK SECURITY

Verify:

- signatures
- timestamps
- replay protection
- idempotency
- source authentication

---

# RETRIES

Implement:

- exponential backoff
- dead-letter handling
- retry limits
- monitoring

---

# TESTING

Use mocked provider adapters.

Never make automated tests dependent on live third-party services.

Test:

- successful order
- duplicate webhook
- delayed webhook
- malformed payload
- provider outage
- timeout
- authentication failure
- rate limit
- retry
- recovery

Manual integration test plans must exist for every provider.

---

# DOCUMENTATION

Create:

/docs/integrations/README.md

and one document per provider.

Clearly mark:

SUPPORTED
MOCKED
PENDING CREDENTIALS
PENDING API ACCESS
NOT IMPLEMENTED