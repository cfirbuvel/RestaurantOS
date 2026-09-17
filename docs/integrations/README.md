# RestaurantOS — Integration Hub Documentation

**Document ID:** `DOC-INT-002`  
**Version:** `1.0.0`  
**Status:** Approved Architectural Specification  

---

## 1. Overview & Architecture

The **Integration Hub** acts as the anti-corruption layer separating RestaurantOS core business logic from third-party vendor APIs, protocols, and proprietary payload formats.

### 1.1 Classification Matrix (PHASE 00 §35)

| Category | Domain | Provider | Integration Status | Adapter Status |
| :--- | :--- | :--- | :--- | :--- |
| **Core Business** | Aggregator | **Wolt** | `SUPPORTED` | `MOCKED` (MockWoltAdapter) |
| **Core Business** | Aggregator | **10bis** | `SUPPORTED` | `MOCKED` (MockTenBisAdapter) |
| **Core Business** | Aggregator | **Mishloha** | `SUPPORTED` | `MOCKED` (MockMishlohaAdapter) |
| **Core Business** | Fiscal / Invoice | **Green Invoice** (חשבונית ירוקה) | `SUPPORTED` | `MOCKED` (MockGreenInvoiceAdapter) |
| **Core Business** | Fiscal / Accounting| **Rivhit** (רווחיות) | `SUPPORTED` | `MOCKED` (MockRivhitAdapter) |
| **Core Business** | Fiscal / Invoice | **iCount** | `SUPPORTED` | `MOCKED` (MockICountAdapter) |
| **Core Business** | Payment Gateway | **Meshulam** (משולם) | `SUPPORTED` | `MOCKED` (MockMeshulamAdapter) |
| **Platform / Infra**| Global Payments | **Stripe** | `SUPPORTED` | `MOCKED` (MockStripeAdapter) |
| **Platform / Infra**| Communications | **Twilio / Infobip** | `SUPPORTED` | `MOCKED` (NotificationService) |
| **Platform / Infra**| Telephony PBX | **SIP / WebRTC** | `SUPPORTED` | `MOCKED` (MockSIPAdapter) |
| **Platform / Infra**| Fleet Telematics | **IoT GPS / LTE** | `SUPPORTED` | `MOCKED` (MockTrackerAdapter) |

---

## 2. The Normalized 10-Step Pipeline (PHASE 00 §36)

All external webhook events must pass through the canonical 10-step pipeline:

```text
Receive Webhook / Inbound Payload
  ↓
Verify Cryptographic Signature (HMAC-SHA256 constant-time)
  ↓
Verify Timestamp Freshness (Strict 300s window against replay attacks)
  ↓
Check Idempotency Key & Redis Lock (lock:webhook:<provider>:<id>)
  ↓
Transform External Payload (Provider Adapter)
  ↓
Universal Canonical DTO (UniversalExternalOrderDTO / UniversalInvoiceDTO)
  ↓
Zod Schema Validation
  ↓
Persist to DB inside Transaction (OrderService / CRM / Invoicing)
  ↓
Insert to Transactional Outbox (outbox table)
  ↓
Publish Domain Event & Realtime WebSocket Dispatch (POS / KDS)
```

---

## 3. Resilience, Retries & Dead-Letter Queue

Outbound integration operations (status callbacks, invoice issuance) utilize an **Exponential Backoff Retry Queue**:
- **Delay formula:** $delay = \text{baseDelay} \times 2^{\text{attempt} - 1}$
- **Max Retries:** 5 attempts before escalation.
- **Dead-Letter Handling:** Unrecoverable failures are routed to the `integration_dead_letters` queue for manual inspection and replay via `/api/v1/integrations/dead-letters`.

---

## 4. Provider Reference Guides

- [WOLT.md](./WOLT.md)
- [10BIS.md](./10BIS.md)
- [MISHLOHA.md](./MISHLOHA.md)
- [GREEN_INVOICE.md](./GREEN_INVOICE.md)
- [RIVHIT.md](./RIVHIT.md)
- [ICOUNT.md](./ICOUNT.md)
- [MESHULAM.md](./MESHULAM.md)
- [STRIPE.md](./STRIPE.md)
