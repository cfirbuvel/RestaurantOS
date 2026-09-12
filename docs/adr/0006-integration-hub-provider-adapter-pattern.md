# ADR 0006: Integration Hub Provider-Adapter Pattern

**Status:** Accepted  
**Date:** 2026-09-09  
**Deciders:** Lead Systems Architect  

---

## Context
RestaurantOS must interface with various third-party platforms in Israel and internationally: Aggregators (Wolt, 10bis, Mishloha), Fiscal Invoicing (Green Invoice, Rivhit, iCount), and Payment Processors (Meshulam, Stripe). Direct vendor coupling in business services creates severe technical debt and test fragility.

## Decision
1. Implement a **Provider-Adapter Pattern** inside the `Integration Hub` context:
   $$\text{External Vendor API} \longleftrightarrow \text{Provider Adapter} \longleftrightarrow \text{Integration Interface} \longleftrightarrow \text{RestaurantOS Core}$$
2. All adapters implement standard TypeScript interfaces (`IAggregatorAdapter`, `IInvoiceAdapter`, `IPaymentGatewayAdapter`, `ITelephonyAdapter`).
3. Maintain in-memory Mock Adapters (`MockWoltAdapter`, `MockStripeAdapter`, etc.) for deterministic local development and automated CI testing.

## Consequences
- **Positive:** Core business logic is 100% agnostic to external vendor quirks; switching invoice or payment providers requires zero core refactoring.
- **Negative:** Requires maintaining transformer mappings and mock suites for each supported vendor.
