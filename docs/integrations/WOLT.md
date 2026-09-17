# Wolt Aggregator Integration Specification

**Status:** `SUPPORTED` | `MOCKED` (`MockWoltAdapter`)  
**Environment Variables Required:**
- `WOLT_API_KEY` (`PENDING CREDENTIALS`)
- `WOLT_WEBHOOK_SECRET` (`PENDING CREDENTIALS`)
- `WOLT_API_URL` (Default: `https://restaurant-api.wolt.com/v1`)

---

## 1. Overview
Wolt is a leading food delivery platform. RestaurantOS integrates bi-directionally with Wolt:
- **Inbound:** Webhook notifications for order creation (`order.created`) and cancellations.
- **Outbound:** Order lifecycle callbacks (`received` -> `in_preparation` -> `ready_for_pickup` -> `delivered`).

## 2. Webhook Authentication & Security
- **Algorithm:** HMAC-SHA256
- **Header:** `X-Wolt-Signature`
- **Timestamp Header:** `X-Wolt-Timestamp` (rejection if age > 300s)
- **Endpoint:** `POST /api/v1/integrations/webhooks/wolt`

## 3. Canonical Mapping
- Order items, options/modifiers, delivery address coordinates, and customer details map to `UniversalExternalOrderDTO`.
- Financial amounts in Wolt are sent in cents/agorot; adapter normalizes to decimal ILS.
- Ingested as `channel: 'WOLT'` in RestaurantOS.

## 4. Testing & Mocks
Automated unit tests use `MockWoltAdapter` with `signPayload()` to simulate inbound orders, bad signatures, stale timestamps, and status callbacks without live Wolt API credentials.
