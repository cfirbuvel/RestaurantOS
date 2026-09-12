# RestaurantOS — Master Integration Hub Specification

**Document ID:** `DOC-INT-001`  
**Version:** `1.1.0`  
**Status:** Approved Canonical Integration Specification  

---

## 1. Integration Hub Architecture & Classification

The **Integration Hub** decouples RestaurantOS domain models from third-party vendor APIs, protocols, and proprietary payload formats.

```mermaid
graph LR
    subgraph Core Business Integrations
        WoltAPI[Wolt Aggregator]
        TenBisAPI[10bis Aggregator]
        MishlohaAPI[Mishloha Aggregator]
        GreenInvoiceAPI[Green Invoice]
        RivhitAPI[Rivhit Accounting]
        MeshulamAPI[Meshulam Payments]
    end

    subgraph Platform & Infrastructure Integrations
        StripeAPI[Stripe Gateway]
        TwilioAPI[Twilio SMS/WhatsApp]
        SIPAPI[SIP PBX Telephony]
        TrackerAPI[IoT Fleet Telematics]
    end

    subgraph Integration Adapters [Adapter Decoupling Layer]
        AggregatorAdapters[Aggregator Adapters]
        InvoiceAdapters[Invoice Adapters]
        PaymentAdapters[Payment Adapters]
        CommAdapters[Communication Adapters]
        TrackerAdapter[ITrackerAdapter / MockTracker]
    end

    subgraph Canonical Domain Core [RestaurantOS Core Domain Engine]
        OrderEngine[Universal Order Engine]
        BillingEngine[Accounting & Fiscal Engine]
        PaymentEngine[Payment Processing Engine]
        FleetEngine[Fleet & Telematics Engine]
    end

    Core Business Integrations <--> Integration Adapters
    Platform & Infrastructure Integrations <--> Integration Adapters
    Integration Adapters --> Canonical Domain Core
```

---

## 2. Integration Provider Classification Matrix

### 2.1 Core Business Integrations
| Domain | Provider | Integration Type | Architecture Status | Mock Adapter Available |
| :--- | :--- | :--- | :--- | :--- |
| **Delivery Aggregator** | **Wolt** | Bi-directional Webhooks & REST Menu Sync | `SUPPORTED (Spec Ready)` | ✅ `MockWoltAdapter` |
| **Delivery Aggregator** | **10bis** | Order Ingestion & POS Settlement | `SUPPORTED (Spec Ready)` | ✅ `MockTenBisAdapter` |
| **Delivery Aggregator** | **Mishloha** | Order Ingestion & Webhook Dispatch | `SUPPORTED (Spec Ready)` | ✅ `MockMishlohaAdapter` |
| **Fiscal Invoicing** | **Green Invoice** | REST API E-Invoice & Receipt Generation | `SUPPORTED (Spec Ready)` | ✅ `MockGreenInvoiceAdapter` |
| **Fiscal Invoicing** | **Rivhit** | Accounting & Inventory Sync | `SUPPORTED (Spec Ready)` | ✅ `MockRivhitAdapter` |
| **Fiscal Invoicing** | **iCount** | Digital Tax Invoice & Credit Clearing | `SUPPORTED (Spec Ready)` | ✅ `MockICountAdapter` |
| **Payment Gateway** | **Meshulam** | Israeli Credit Card Clearing & Tokenization | `SUPPORTED (Spec Ready)` | ✅ `MockMeshulamAdapter` |

### 2.2 Platform & Infrastructure Integrations
| Domain | Provider | Integration Type | Architecture Status | Mock Adapter Available |
| :--- | :--- | :--- | :--- | :--- |
| **Payment Gateway** | **Stripe** | International Card Clearing & Subscriptions | `SUPPORTED (Spec Ready)` | ✅ `MockStripeAdapter` |
| **Communications** | **Twilio** | SMS & WhatsApp Customer Notifications | `SUPPORTED (Spec Ready)` | ✅ `MockTwilioAdapter` |
| **Telephony / PBX** | **SIP / WebRTC** | PBX Incoming Call Event & Caller ID | `SUPPORTED (Spec Ready)` | ✅ `MockSIPAdapter` |
| **Fleet Telematics** | **IoT GPS / LTE** | Hardware Tracker Telemetry Stream | `SUPPORTED (Spec Ready)` | ✅ `MockTrackerAdapter` |
| **Mapping & Routing** | **Google / Mapbox** | Geocoding & Travel Distance Matrix | `SUPPORTED (Spec Ready)` | ✅ `MockMapsAdapter` |

---

## 3. IoT Tracker Provider Abstraction (`ITrackerAdapter`)

The Integration Hub defines an abstract interface for telematics hardware providers:

```typescript
export interface ITrackerAdapter {
  getDeviceStatus(trackerId: string): Promise<TrackerStatusDTO>;
  getLatestLocation(trackerId: string): Promise<VehicleLocationDTO>;
  subscribeToTelemetry(trackerId: string, callback: (location: VehicleLocationDTO) => void): Promise<void>;
  processWebhook(payload: unknown, headers: Record<string, string>): Promise<VehicleLocationDTO>;
  normalizeTelemetry(rawPacket: unknown): VehicleLocationDTO;
}
```

### 3.1 Primary vs Secondary Telematics Standards
- **Primary Operational Fleet Telemetry:** Active continuous GPS + cellular/LTE telematics providing sub-minute location updates, speed, heading, and battery telemetry.
- **Secondary / Backup Anti-Theft:** Bluetooth crowd-sourced tracking (e.g. Apple AirTag / Find My network) is categorized strictly as secondary anti-theft asset recovery and MUST NOT be used as the primary real-time operational dispatch telemetry source.

---

## 4. Normalized Integration Pipeline

All external events follow the canonical 10-step integration pipeline:

$$\text{Receive} \rightarrow \text{Verify Signature} \rightarrow \text{Verify Timestamp} \rightarrow \text{Check Idempotency} \rightarrow \text{Transform} \rightarrow \text{Universal DTO} \rightarrow \text{Validate} \rightarrow \text{Persist} \rightarrow \text{Transactional Outbox} \rightarrow \text{Publish Domain Event}$$
