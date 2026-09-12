# RestaurantOS — Phase 0 Contract Alignment & Consistency Audit Report

**Document ID:** `DOC-ALIGN-REPORT-001`  
**Date:** 2026-09-12  
**Auditor / Decider:** Principal Software Architect, Security Architect, Database Architect, API Architect, QA Architect  
**Status:** Canonical Sign-Off Report  

---

## 1. Executive Summary

A comprehensive architectural amendment and contract alignment was performed across all Phase 0 documentation, specifications, schemas, ADRs, and API definitions of **RestaurantOS**.

### Key Architectural Corrections Applied:
1. **Order vs Delivery Lifecycle Separation:** Completely decoupled the customer purchase/kitchen order state machine (`DRAFT` $\rightarrow$ `COMPLETED`) from the logistics delivery state machine (`WAITING` $\rightarrow$ `DELIVERED`). Non-delivery orders (Dine-in, Takeaway, Kiosk) never instantiate a `Delivery` entity.
2. **Explicit Domain Commands:** Replaced generic CRUD status mutations (`PATCH /orders/:id/status`) with explicit domain commands (`POST /orders/:id/confirm`, `POST /deliveries/:id/self-assign`, `POST /deliveries/:id/release`, `POST /drivers/me/return-from-break`, etc.).
3. **Multidimensional Driver State & Queue:** Separated Driver state into Shift Status, Assignment Status, and Trip Status. Defined FIFO availability queue priority based strictly on `available_since ASC`. Disambiguated `DriverReturnedFromBreak` from `DriverReturnedToRestaurant`.
4. **First-Class Fleet & Telematics Domain:** Modeled `Vehicle`, `Tracker`, `DriverVehicleAssignment`, `VehicleTrackerAssignment`, `VehicleLocation` (partitioned), `VehicleTrip`, and `GeofenceEvent`. Defined the **Telemetry $\neq$ Business Truth** principle (GPS entry into customer geofence never auto-completes delivery without driver/human confirmation).
5. **Security & Ticketed WebSockets:** Eliminated long-lived JWTs in WebSocket query strings in favor of a 2-step ephemeral ticket handshake (`POST /api/v1/realtime/ticket`). Enforced data minimization for couriers via `DeliveryViewDTO`.
6. **Smart Batching & Gen 1 Scaffolding:** Preserved deterministic heuristic batching for Gen 1 with mandatory human Manager Approval, logging all decision telemetry into `intelligence_decision_logs`.

---

## 2. Documents Modified & Created

| File Path | Nature of Modification | Status |
| :--- | :--- | :--- |
| [`/docs/README.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/README.md) | Updated index, added ADR 0009, EVENTS.md, and alignment status | `Amended & Approved` |
| [`/docs/ARCHITECTURE.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/ARCHITECTURE.md) | Decoupled Order vs Delivery, added Fleet hierarchy, KDS SLA model, and inventory policy | `Amended & Approved` |
| [`/docs/PRODUCT_REQUIREMENTS.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/PRODUCT_REQUIREMENTS.md) | Aligned requirements across 44 modules, fleet telematics, and UX guidelines | `Amended & Approved` |
| [`/docs/API.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/API.md) | Explicit domain commands, single vs list response envelopes, ticket-based WebSockets | `Amended & Approved` |
| [`/docs/EVENTS.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/EVENTS.md) | **NEW:** Master Domain Event Catalog (Order, Delivery, Driver, Vehicle, Tracker, Batch, KDS) | `Created & Approved` |
| [`/docs/DATABASE.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/DATABASE.md) | Added telemetry range partitioning and multi-tenant composite integrity rules | `Amended & Approved` |
| [`/docs/database/SCHEMA.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/database/SCHEMA.md) | Added fleet/tracker tables, multidimensional driver enums, batch metadata, decision logs | `Amended & Approved` |
| [`/docs/SECURITY.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/SECURITY.md) | Added fleet tracking privacy, shift-scoped location capture, and 30-day retention | `Amended & Approved` |
| [`/docs/security/SECURITY_ARCHITECTURE.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/security/SECURITY_ARCHITECTURE.md) | Ticketed WebSocket handshake, channel boundaries, `DeliveryViewDTO` data minimization | `Amended & Approved` |
| [`/docs/INTEGRATIONS.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/INTEGRATIONS.md) | Classified integrations (Core Business vs Platform), added `ITrackerAdapter` | `Amended & Approved` |
| [`/docs/ROADMAP.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/ROADMAP.md) | Updated Phase 4 title to include Fleet Tracking & Telematics; updated Gen 1–5 | `Amended & Approved` |
| [`/docs/IMPLEMENTATION_STATUS.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/IMPLEMENTATION_STATUS.md) | Marked Phase 0 as `AMENDED / READY FOR PHASE 1`, Phase 1 queued as `PENDING` | `Amended & Approved` |
| [`/docs/TESTING_STRATEGY.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/testing/TESTING_STRATEGY.md) | Added master contract matrix, race condition collision suites, and fleet test cases | `Amended & Approved` |
| [`/docs/adr/0004-universal-order-model-and-state-machine.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0004-universal-order-model-and-state-machine.md) | Amended: Decoupled Order state machine from Delivery logistics | `Amended & Approved` |
| [`/docs/adr/0007-delivery-dispatch-concurrency-and-smart-batching.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0007-delivery-dispatch-concurrency-and-smart-batching.md) | Amended: Driver availability queue, separate delivery states, atomic row locks | `Amended & Approved` |
| [`/docs/adr/0008-gen1-human-operated-and-future-ai-scaffolding.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0008-gen1-human-operated-and-future-ai-scaffolding.md) | Amended: Fleet intelligence boundary, supervised decision telemetry logging | `Amended & Approved` |
| [`/docs/adr/0009-vehicle-fleet-tracking-and-telemetry-architecture.md`](file:///f:/Developing/Web/ShorTech/RestaurantOS/docs/adr/0009-vehicle-fleet-tracking-and-telemetry-architecture.md) | **NEW:** Vehicle, Tracker, Telematics, and Telemetry $\neq$ Business Truth ADR | `Created & Approved` |

---

## 3. Detailed Domain & Contract Corrections

### 3.1 Order Lifecycle vs Delivery Lifecycle
- **Universal Order:** $\text{DRAFT} \rightarrow \text{CONFIRMED} \rightarrow \text{ACCEPTED} \rightarrow \text{IN\_PREPARATION} \rightarrow \text{READY} \rightarrow \text{COMPLETED}$ *(Terminal: `CANCELLED`, `FAILED`)*.
- **Delivery Logistics:** $\text{WAITING} \rightarrow \text{PREPARING} \rightarrow \text{READY} \rightarrow \text{AVAILABLE\_FOR\_ASSIGNMENT} \rightarrow \text{ASSIGNED} \rightarrow \text{PICKED\_UP} \rightarrow \text{OUT\_FOR\_DELIVERY} \rightarrow \text{ARRIVED\_AT\_CUSTOMER\_AREA} \rightarrow \text{DELIVERED}$ *(Terminal: `FAILED`, `CANCELLED`)*.
- **Release Semantics:** A released delivery transitions from `ASSIGNED` back to `AVAILABLE_FOR_ASSIGNMENT`.

### 3.2 Driver State Dimensions & Availability Queue
- **Shift Status:** `OFF_SHIFT`, `ON_SHIFT`, `BREAK`.
- **Assignment Status:** `AVAILABLE`, `ASSIGNED`.
- **Trip Status:** `NOT_STARTED`, `IN_TRANSIT`, `AT_CUSTOMER`, `RETURNING`.
- **Queue Priority:** Dynamically computed from `available_since ASC`.
- **Return Events:** `DriverReturnedFromBreak` vs `DriverReturnedToRestaurant` emit distinct domain events and update timestamps independently.

### 3.3 Fleet & Telematics Domain
- **Asset Separation:** `Vehicle` (physical vehicle) $\leftrightarrow$ `Tracker` (IoT hardware device).
- **Temporal Linkages:** `DriverVehicleAssignment` and `VehicleTrackerAssignment`.
- **Primary vs Secondary:** GPS+LTE cellular is primary; AirTags are secondary anti-theft only.
- **Telemetry $\neq$ Business Truth:** Geofence arrival triggers `ARRIVED_AT_CUSTOMER_AREA` but **never** triggers `DELIVERED` without driver/human confirmation.

### 3.4 API & Real-Time Security
- **Single vs List Response Envelopes:** Single resource/action endpoints omit useless pagination objects.
- **WebSocket Ticket Auth:** Ephemeral single-use 60s ticket (`POST /api/v1/realtime/ticket`) replaces JWT in URL parameters.
- **Driver Least Privilege:** Couriers receive `DeliveryViewDTO` (masked contact, address, delivery notes) with zero access to CRM order history.

### 3.5 Inventory Depletion Policy
- Configurable policy: `ON_ACCEPTED` (Default), `ON_PREPARATION_START`, `ON_FULFILLMENT`.

---

## 4. Master Contract Alignment Matrix

| Domain Concept | Domain Model | Database Schema | API Spec | Event Catalog | Security Rules | Test Strategy |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Order** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Delivery** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Driver** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Driver Queue** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vehicle** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tracker** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vehicle Location**| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vehicle Trip** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Geofence** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Smart Batch** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. Final Acceptance Checklist Verification

- [x] Order lifecycle is independent from Delivery lifecycle.
- [x] Delivery lifecycle is explicitly defined with `AVAILABLE_FOR_ASSIGNMENT` release target.
- [x] Driver shift, assignment, and trip dimensions are cleanly separated.
- [x] Driver availability queue is based on `available_since ASC`.
- [x] Driver return-from-break is distinct from physical restaurant return.
- [x] Self-assignment is atomic and auditable with race-condition protection.
- [x] Delivery Assignment Engine is the single assignment source of truth (Strategy Pattern).
- [x] Smart batching is deterministic in Gen 1 with mandatory human Manager Approval.
- [x] Vehicle is a first-class domain object.
- [x] Driver ↔ Vehicle assignment is temporally modeled.
- [x] Tracker is a first-class domain object.
- [x] Vehicle ↔ Tracker assignment is temporally modeled.
- [x] `VehicleLocation` is modeled with range partitioning.
- [x] `VehicleTrip` and `GeofenceEvent` are modeled.
- [x] `ITrackerAdapter` and `MockTrackerAdapter` abstractions are defined.
- [x] AirTag-like tracking is explicitly secondary, not primary fleet telemetry.
- [x] GPS arrival does not automatically equal delivery completion.
- [x] Vehicle telemetry and tracker events are cataloged in `EVENTS.md`.
- [x] WebSocket authentication uses ephemeral connection tickets.
- [x] Realtime channels enforce strict role authorization boundaries.
- [x] Driver receives restricted `DeliveryViewDTO` data.
- [x] Tenant and branch integrity is enforced across database, API, and events.
- [x] Inventory deduction timing is configurable and explicitly defaulted (`ON_ACCEPTED`).
- [x] Core Business vs Platform/Infrastructure integrations are separated.
- [x] Decision logging in `intelligence_decision_logs` prepares data for Gen 2+ ML models.
- [x] ADR 0004, ADR 0007, and ADR 0008 are updated and consistent.
- [x] ADR 0009 is authored and accepted.
- [x] ROADMAP.md and IMPLEMENTATION_STATUS.md are updated and aligned.
- [x] Zero production/Phase 1 implementation code was written.

---

## 6. Remaining Risks & Considerations

| Risk Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| High-frequency GPS ping volume in production | Low / Medium | Addressed via PostgreSQL range partitioning on `vehicle_locations` + 30-day automated data rotation + trip aggregation. |
| Third-party aggregator API contract changes | Low | Isolated strictly behind Provider Adapter subsystem in Integration Hub; zero impact on core domain models. |

---

## 7. Consistency Result & Sign-Off

> **CONSISTENCY RESULT:**  
> 🟢 **PASS — READY FOR PHASE 1**

All architectural contradictions have been eliminated. The technical contracts across Domain Models, Database Schemas, API Endpoints, Event Streams, Security Controls, and Testing Matrices are 100% unified and internally consistent.
