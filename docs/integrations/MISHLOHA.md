# Mishloha Aggregator Integration Specification

**Status:** `SUPPORTED` | `MOCKED` (`MockMishlohaAdapter`)  
**Environment Variables Required:**
- `MISHLOHA_API_KEY` (`PENDING CREDENTIALS`)
- `MISHLOHA_WEBHOOK_SECRET` (`PENDING CREDENTIALS`)

---

## 1. Overview
Mishloha (משלוחה) is a popular Israeli delivery marketplace.
- **Inbound:** Order notifications via JSON webhooks.
- **Outbound:** Order status confirmations.

## 2. Webhook Authentication & Security
- **Algorithm:** HMAC-SHA256
- **Header:** `X-Mishloha-Signature`
- **Timestamp Header:** `X-Mishloha-Timestamp` (rejection if age > 300s)
- **Endpoint:** `POST /api/v1/integrations/webhooks/mishloha`

## 3. Canonical Mapping
- Maps `orderId`, `customer.fullName`, `orderItems`, `extras`, and delivery coordinates to `UniversalExternalOrderDTO`.
- Stored under `channel: 'MISHLOHA'`.
