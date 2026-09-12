# RestaurantOS — Master Security & Compliance Policy

**Document ID:** `DOC-SEC-001`  
**Version:** `1.1.0`  
**Status:** Approved Canonical Security Policy  
**Classification:** Enterprise SaaS Security Standard  

---

## 1. Security Philosophy & Threat Modeling

RestaurantOS operates in high-volume, multi-tenant hospitality environments where system availability, financial integrity, and customer/employee privacy are mission-critical. Security is engineered into the platform from day one using a **Zero Trust / Defense-in-Depth** strategy.

### STRIDE Threat Model Assessment:
| Threat Category | Potential Risk in RestaurantOS | Mitigation Strategy |
| :--- | :--- | :--- |
| **Spoofing** | Forged driver self-assignment or unauthorized staff login. | Short-lived ticket WebSocket handshakes, Argon2id passwords, bcrypt PINs with lockout gates. |
| **Tampering** | Modifying order prices, delivery tips, or invoice totals. | Server-authoritative calculations, immutable outbox events, HMAC webhook signatures. |
| **Repudiation** | Staff denying order cancellation or cash drawer void. | Append-only immutable `audit_logs` capturing actor ID, timestamp, IP, and state diff. |
| **Information Disclosure** | Cross-tenant data leak or driver accessing full CRM records. | PostgreSQL RLS + strict `DeliveryViewDTO` data minimization (masking customer PII). |
| **Denial of Service** | Flooding public order endpoints or webhook receivers. | Cloudflare WAF, Redis token-bucket rate limiting, payload size caps (`100KB` default). |
| **Elevation of Privilege** | Cashier or Driver calling Manager batch approval endpoints. | Granular server-side permission gates (`@RequirePermission('delivery:manage')`). |

---

## 2. Regulatory Compliance & Data Privacy

1. **PCI-DSS Compliance (Level SAQ A):**
   - No raw credit card primary account numbers (PAN) or CVVs touch or traverse RestaurantOS servers.
   - Payment input is handled strictly via iframe-hosted fields / Web SDKs from certified gateways (Stripe Elements, Meshulam hosted tokenizers).
2. **GDPR & Israeli Privacy Protection Law (Amendment 13):**
   - Customer right to access and right to be forgotten (soft-delete anonymization of PII after order fulfillment).
   - Encryption of personal identifiable information (PII) at rest using AES-256.
   - Strict role-based masking: Kitchen line cooks and drivers receive only strictly required operational fields.

---

## 3. Fleet Tracking Privacy & Data Minimization

1. **Operational Asset Tracking vs Employee Surveillance:**
   - Fleet tracking monitors the **Vehicle / IoT Tracker Asset**, not personal employee devices.
   - Location telemetry is collected strictly during active shift assignments (`DriverVehicleAssignment.unassigned_at IS NULL`).
   - Personal tracking outside delivery operating hours is prohibited.
2. **Telemetry Data Lifecycle:**
   - High-frequency GPS telemetry packets in `vehicle_locations` are retained for a rolling window of 30 days.
   - Trips are summarized into aggregated records (`vehicle_trips`) for reporting and auditing.
3. **Access Controls & Auditing:**
   - Raw live telemetry channels (`branch:<id>:telemetry`) are restricted to Fleet Managers and Dispatchers.
   - Public customer tracking receives smoothed, anonymized coordinates strictly between `OUT_FOR_DELIVERY` and `DELIVERED`.
