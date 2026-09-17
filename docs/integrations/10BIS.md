# 10bis Aggregator Integration Specification

**Status:** `SUPPORTED` | `MOCKED` (`MockTenBisAdapter`)  
**Environment Variables Required:**
- `TENBIS_API_KEY` (`PENDING CREDENTIALS`)
- `TENBIS_WEBHOOK_SECRET` (`PENDING CREDENTIALS`)

---

## 1. Overview
10bis (תן ביס) is Israel's primary corporate lunch meal aggregator.
- **Inbound:** Order notifications with corporate employee billing.
- **Outbound:** Order confirmation and status callbacks.

## 2. Webhook Authentication & Security
- **Algorithm:** HMAC-SHA256
- **Header:** `X-10bis-Signature`
- **Timestamp Header:** `X-10bis-Timestamp` (rejection if age > 300s)
- **Endpoint:** `POST /api/v1/integrations/webhooks/tenbis`

## 3. Canonical Mapping
- Maps `OrderNumber`, `CompanyName`, `Remarks`, dish codes, and modifiers to `UniversalExternalOrderDTO`.
- Stored under `channel: 'TENBIS'`.
