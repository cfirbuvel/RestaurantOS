# ADR 0004: Universal Order Model & Independent Order Lifecycle

**Status:** Accepted (Amended)  
**Date:** 2026-09-12  
**Deciders:** Lead Systems Architect, Order Domain Lead  

---

## Context
Orders originate from multiple channels (Website, POS, Kiosk, Phone, Wolt, 10bis, Mishloha) and serve various order types (Dine-in, Takeaway, Delivery, Drive-thru, Curbside). Previously, there was a risk of coupling delivery transportation milestones into the core order status enum. We must strictly decouple the Order lifecycle from the Delivery logistics lifecycle.

## Decision
1. **Universal Order Normalization:**
   - Inbound adapters convert channel-specific orders into the canonical `UniversalOrderDTO` / `orders` table.
2. **Canonical Universal Order Lifecycle:**
   $$\text{DRAFT} \rightarrow \text{CONFIRMED} \rightarrow \text{ACCEPTED} \rightarrow \text{IN\_PREPARATION} \rightarrow \text{READY} \rightarrow \text{COMPLETED}$$
   - Terminal cancellation/failure paths: $\text{CANCELLED}$, $\text{FAILED}$.
3. **Strict Separation of Concerns:**
   - **Order Status:** Represents the lifecycle of the customer's purchase and kitchen readiness.
   - **Delivery Status:** Handled by the independent `deliveries` aggregate (`WAITING`, `PREPARING`, `READY`, `AVAILABLE_FOR_ASSIGNMENT`, `ASSIGNED`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `ARRIVED_AT_CUSTOMER_AREA`, `DELIVERED`, `FAILED`, `CANCELLED`).
   - Non-delivery orders (Dine-in, Takeaway, Kiosk) transition directly from `READY` to `COMPLETED` when served/collected, without ever creating or referencing a `Delivery` entity.

## Consequences
- **Positive:** Pristine domain separation; dining-in and takeaway orders are never polluted with courier concepts; KDS rails and financial reporting remain clean.
- **Negative:** Requires an event bridge (`OrderReady` -> `DeliveryBecameAssignable`, and `DeliveryCompleted` -> `OrderCompleted`) for delivery orders.
